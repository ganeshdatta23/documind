"""
Auth Service — Core authentication business logic.
Handles login, token issuance, refresh, logout, and account locking.
"""
from datetime import UTC, datetime
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.exceptions import (
    AccountLockedError,
    AuthenticationError,
    InvalidTokenError,
    TokenRevokedError,
    UserNotFoundError,
)
from models import RefreshToken, User
from redis_client import SlidingWindowRateLimiter, blocklist_token, is_token_blocked
from security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_token,
    verify_password,
)

from .repository import AuthRepository
from .schemas import TokenResponse, UserInToken

logger = structlog.get_logger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class AuthService:
    def __init__(self, repo: AuthRepository, redis) -> None:
        self.repo = repo
        self.redis = redis

    async def login(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[TokenResponse, str]:
        """
        Authenticate user with email/password.
        Returns (TokenResponse, raw_refresh_token).
        Raises AuthenticationError on failure.
        """
        # Load user (search across all tenants for email — use tenant slug in multi-tenant setup)
        user = await self.repo.get_user_by_email(email)
        if not user:
            # Constant time response to prevent email enumeration
            from security import verify_password as vp
            vp("dummy", "$2b$12$dummyhashtopreventtimingattack123")
            raise AuthenticationError("Invalid email or password")

        # Check account lock
        if user.locked_until and user.locked_until > datetime.now(UTC):
            raise AccountLockedError(
                f"Account locked until {user.locked_until.strftime('%H:%M UTC')}"
            )

        # Verify password
        if not user.hashed_password or not verify_password(password, user.hashed_password):
            await self._handle_failed_login(user)
            raise AuthenticationError("Invalid email or password")

        # Reset failed attempts on successful login
        await self.repo.update_login_success(user.id, ip_address)

        # Get user roles
        roles = [role.name for role in user.roles]

        # Issue tokens
        access_token, expires_at = create_access_token(
            user_id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            roles=roles,
            is_superadmin=user.is_superadmin,
        )
        raw_refresh, refresh_hash, refresh_expires = create_refresh_token()

        # Store refresh token
        await self.repo.create_refresh_token(
            user_id=user.id,
            tenant_id=user.tenant_id,
            token_hash=refresh_hash,
            expires_at=refresh_expires,
            ip_address=ip_address,
            device_info={"user_agent": user_agent or ""},
        )

        logger.info("auth.login.success", user_id=str(user.id), tenant_id=str(user.tenant_id))

        token_response = TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserInToken(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                tenant_id=user.tenant_id,
                roles=roles,
                is_superadmin=user.is_superadmin,
            ),
        )
        return token_response, raw_refresh

    async def refresh_access_token(self, raw_refresh_token: str) -> tuple[TokenResponse, str]:
        """Exchange a valid refresh token for new access + refresh tokens (rotation)."""
        token_hash = hash_token(raw_refresh_token)
        stored = await self.repo.get_refresh_token(token_hash)

        if not stored or stored.revoked_at or stored.expires_at < datetime.now(UTC):
            raise InvalidTokenError("Refresh token is invalid or expired")

        user = await self.repo.get_user_by_id(stored.user_id, stored.tenant_id)
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        # Revoke old token (rotation)
        await self.repo.revoke_refresh_token(stored.id)

        # Issue new tokens
        roles = [role.name for role in user.roles]
        access_token, _ = create_access_token(
            user_id=user.id, tenant_id=user.tenant_id,
            email=user.email, roles=roles, is_superadmin=user.is_superadmin,
        )
        raw_new_refresh, new_hash, new_expires = create_refresh_token()
        await self.repo.create_refresh_token(
            user_id=user.id, tenant_id=user.tenant_id,
            token_hash=new_hash, expires_at=new_expires,
        )

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserInToken(
                id=user.id, email=user.email, full_name=user.full_name,
                tenant_id=user.tenant_id, roles=roles, is_superadmin=user.is_superadmin,
            ),
        ), raw_new_refresh

    async def logout(self, jti: str, raw_refresh_token: Optional[str] = None) -> None:
        """Revoke access token (blocklist) and refresh token."""
        # Block the access token JTI
        await blocklist_token(
            self.redis, jti,
            expire_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

        # Revoke refresh token if provided
        if raw_refresh_token:
            token_hash = hash_token(raw_refresh_token)
            stored = await self.repo.get_refresh_token(token_hash)
            if stored:
                await self.repo.revoke_refresh_token(stored.id)

        logger.info("auth.logout", jti=jti)

    async def _handle_failed_login(self, user: User) -> None:
        """Increment failed login counter and lock account if threshold exceeded."""
        new_count = user.failed_login_count + 1
        lock_until = None
        if new_count >= MAX_FAILED_ATTEMPTS:
            from datetime import timedelta
            lock_until = datetime.now(UTC) + timedelta(minutes=LOCKOUT_MINUTES)
            logger.warning("auth.account.locked", user_id=str(user.id), lock_until=str(lock_until))
        await self.repo.update_login_failure(user.id, new_count, lock_until)
