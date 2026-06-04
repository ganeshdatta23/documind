"""
DocuMind FastAPI Dependencies — Centralized DI for auth, tenant, DB, Redis.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.exceptions import (
    AuthenticationError,
    InvalidTokenError,
    PermissionDeniedError,
    TenantNotFoundError,
    TokenRevokedError,
)
from database import async_session_factory
from redis_client import get_redis_pool, is_token_blocked
from security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


# ─── Database Dependency ─────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session with auto commit/rollback."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


DbSession = Annotated[AsyncSession, Depends(get_db)]


# ─── Redis Dependency ─────────────────────────────────────────────────────────

async def get_redis() -> aioredis.Redis:
    """Yield Redis connection from pool."""
    return await get_redis_pool()


RedisConn = Annotated[aioredis.Redis, Depends(get_redis)]


# ─── Auth Dependencies ────────────────────────────────────────────────────────

class TokenData:
    """Parsed JWT payload data."""
    def __init__(self, payload: dict) -> None:
        self.user_id: UUID = UUID(payload["sub"])
        self.tenant_id: UUID = UUID(payload["tid"])
        self.email: str = payload["email"]
        self.roles: list[str] = payload.get("roles", [])
        self.is_superadmin: bool = payload.get("is_superadmin", False)
        self.jti: str = payload.get("jti", "")


async def get_token_data(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    redis: RedisConn,
    db: DbSession,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> TokenData:
    """
    Authenticate the request via a JWT bearer token OR a DocuMind API key.

    - Authorization: Bearer <jwt>            → standard user session
    - Authorization: Bearer dm_live_xxx      → API key
    - X-API-Key: dm_live_xxx                 → API key (header form)

    Raises 401 if no valid credential is present, expired, or revoked.
    """
    from security import API_KEY_PREFIX

    raw = credentials.credentials if credentials else None
    api_key = x_api_key or (raw if raw and raw.startswith(API_KEY_PREFIX) else None)

    if api_key:
        return await _authenticate_api_key(db, api_key)

    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "Authorization header required"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(raw)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": str(e)},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check token blocklist (logout/revocation)
    if payload.get("jti") and await is_token_blocked(redis, payload["jti"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_REVOKED", "message": "Token has been revoked"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenData(payload)


async def _authenticate_api_key(db: AsyncSession, raw_key: str) -> TokenData:
    """Resolve an API key to a TokenData principal (the key owner's identity)."""
    from datetime import UTC, datetime

    from modules.apikey.repository import APIKeyRepository
    from modules.user.repository import UserRepository
    from security import hash_token

    repo = APIKeyRepository(db)
    key = await repo.get_active_by_hash(hash_token(raw_key))
    if not key or (key.expires_at and key.expires_at < datetime.now(UTC)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_API_KEY", "message": "API key is invalid or expired"},
        )

    user = await UserRepository(db).get_by_id(key.user_id, key.tenant_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_API_KEY", "message": "API key owner is inactive"},
        )

    await repo.touch_last_used(key.id)
    return TokenData({
        "sub": str(user.id),
        "tid": str(user.tenant_id),
        "email": user.email,
        "roles": [r.name for r in user.roles],
        "is_superadmin": user.is_superadmin,
        "jti": f"apikey:{key.id}",
    })


CurrentToken = Annotated[TokenData, Depends(get_token_data)]


async def get_current_user(token: CurrentToken, db: DbSession):
    """Load the current user from the database based on JWT claims."""
    from modules.user.repository import UserRepository
    repo = UserRepository(db)
    user = await repo.get_by_id(token.user_id, token.tenant_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User not found or inactive"},
        )
    return user


CurrentUser = Annotated[object, Depends(get_current_user)]


def require_superadmin(token: CurrentToken):
    """Guard: requires superadmin role."""
    if not token.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "SUPERADMIN_REQUIRED", "message": "Superadmin access required"},
        )
    return token


SuperAdmin = Annotated[TokenData, Depends(require_superadmin)]


def require_roles(*required_roles: str):
    """
    Factory for role-based guards.
    Usage: user = Depends(require_roles("org_admin", "manager"))
    """
    def checker(token: CurrentToken) -> TokenData:
        if token.is_superadmin:
            return token  # Superadmin bypasses role checks
        if not any(role in token.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_ROLE",
                    "message": f"Required roles: {', '.join(required_roles)}",
                },
            )
        return token
    return checker


# ─── Pagination ───────────────────────────────────────────────────────────────

from fastapi import Query


class PaginationParams:
    """Standard pagination parameters."""
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number"),
        page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size

    @property
    def limit(self) -> int:
        return self.page_size


Pagination = Annotated[PaginationParams, Depends(PaginationParams)]
