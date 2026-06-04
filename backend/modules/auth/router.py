"""Auth router — login, logout, refresh, me endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import CurrentToken, DbSession, RedisConn, get_token_data
from modules.auth.repository import AuthRepository
from modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
)
from modules.auth.service import AuthService

router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def get_auth_service(db: DbSession, redis: RedisConn) -> AuthService:
    return AuthService(AuthRepository(db), redis)


@router.post("/login", response_model=TokenResponse, summary="User login")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: DbSession,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
):
    """
    Authenticate with email/password.
    Returns access token in body, sets refresh token as HttpOnly cookie.
    """
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    token_response, raw_refresh = await auth_service.login(
        email=payload.email,
        password=payload.password,
        ip_address=ip,
        user_agent=user_agent,
    )

    from core.audit import record_audit
    await record_audit(
        db,
        tenant_id=token_response.user.tenant_id,
        actor_id=token_response.user.id,
        action="auth.login",
        resource_type="session",
        resource_id=token_response.user.id,
        request=request,
    )

    # Set refresh token as HttpOnly cookie (prevents XSS theft)
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/api/v1/auth",
    )

    return token_response


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token(
    response: Response,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    payload: RefreshRequest | None = None,
    cookie_token: str | None = Cookie(None, alias=REFRESH_COOKIE_NAME),
):
    """
    Exchange refresh token for new access + refresh tokens.
    Accepts token from HttpOnly cookie or request body.
    """
    raw_token = (payload.refresh_token if payload else None) or cookie_token
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_REFRESH_TOKEN", "message": "Refresh token required"},
        )

    token_response, new_raw_refresh = await auth_service.refresh_access_token(raw_token)

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=new_raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/api/v1/auth",
    )

    return token_response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Logout")
async def logout(
    response: Response,
    token: CurrentToken,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    payload: LogoutRequest | None = None,
    cookie_token: str | None = Cookie(None, alias=REFRESH_COOKIE_NAME),
):
    """Revoke access and refresh tokens."""
    raw_refresh = (payload.refresh_token if payload else None) or cookie_token
    await auth_service.logout(jti=token.jti, raw_refresh_token=raw_refresh)

    # Clear cookie
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")


@router.get("/me", summary="Get current user info")
async def get_me(token: CurrentToken, db: DbSession):
    """Return the current authenticated user's profile."""
    from modules.user.repository import UserRepository
    repo = UserRepository(db)
    user = await repo.get_by_id(token.user_id, token.tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "tenant_id": str(user.tenant_id),
        "roles": [r.name for r in user.roles],
        "is_superadmin": user.is_superadmin,
    }
