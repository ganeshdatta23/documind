"""Auth repository — data access for users and refresh tokens."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import RefreshToken, User


class AuthRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email (case-insensitive). Includes roles."""
        result = await self.db.execute(
            select(User)
            .where(and_(User.email == email.lower(), User.deleted_at.is_(None)))
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: UUID, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
            ))
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def update_login_success(
        self, user_id: UUID, ip_address: Optional[str]
    ) -> None:
        from datetime import UTC
        await self.db.execute(
            update(User).where(User.id == user_id).values(
                last_login_at=datetime.now(UTC),
                last_login_ip=ip_address,
                failed_login_count=0,
                locked_until=None,
            )
        )

    async def update_login_failure(
        self, user_id: UUID, failed_count: int, locked_until: Optional[datetime]
    ) -> None:
        await self.db.execute(
            update(User).where(User.id == user_id).values(
                failed_login_count=failed_count,
                locked_until=locked_until,
            )
        )

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
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token_id: UUID) -> None:
        from datetime import UTC
        await self.db.execute(
            update(RefreshToken).where(RefreshToken.id == token_id).values(
                revoked_at=datetime.now(UTC)
            )
        )
