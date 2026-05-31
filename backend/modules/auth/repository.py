"""Auth repository — thin session wrapper over queries.auth + queries.users."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from models import RefreshToken, User
from queries.auth import (
    revoke_refresh_token as revoke_token_stmt,
    select_refresh_token_by_hash,
)
from queries.users import (
    select_user,
    select_user_by_email_global,
    update_login_failure,
    update_login_success,
)


class AuthRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email (case-insensitive, cross-tenant). Includes roles."""
        result = await self.db.execute(select_user_by_email_global(email))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: UUID, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(select_user(user_id, tenant_id))
        return result.scalar_one_or_none()

    async def update_login_success(
        self, user_id: UUID, ip_address: Optional[str]
    ) -> None:
        await self.db.execute(update_login_success(user_id, ip_address))

    async def update_login_failure(
        self, user_id: UUID, failed_count: int, locked_until: Optional[datetime]
    ) -> None:
        await self.db.execute(update_login_failure(user_id, failed_count, locked_until))

    async def create_refresh_token(
        self,
        user_id: UUID,
        tenant_id: UUID,
        token_hash: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        device_info: Optional[dict] = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            tenant_id=tenant_id,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            device_info=device_info or {},
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_refresh_token(self, token_hash: str) -> Optional[RefreshToken]:
        result = await self.db.execute(select_refresh_token_by_hash(token_hash))
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token_id: UUID) -> None:
        await self.db.execute(revoke_token_stmt(token_id))
