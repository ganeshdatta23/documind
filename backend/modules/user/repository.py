"""User repository — user CRUD with tenant isolation."""
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: UUID, tenant_id: UUID) -> Optional[User]:
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

    async def get_by_email(self, email: str, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(and_(
                User.email == email.lower(),
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
            ))
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user
