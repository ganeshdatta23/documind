"""User repository — fixed imports to match models.py exports."""
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import Role, User, user_roles_table


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: UUID, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(
                and_(
                    User.id == user_id,
                    User.tenant_id == tenant_id,
                    User.deleted_at.is_(None),
                )
            )
            .options(selectinload(User.roles))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(
                and_(
                    User.email == email.lower(),
                    User.tenant_id == tenant_id,
                    User.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        tenant_id: UUID,
        *,
        is_active: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        q = (
            select(User)
            .where(
                and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
            )
            .options(selectinload(User.roles))
        )
        if is_active is not None:
            q = q.where(User.is_active == is_active)

        total = await self.db.scalar(
            select(func.count()).select_from(q.subquery())
        )
        result = await self.db.execute(
            q.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total or 0

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user, ["roles"])
        return user

    async def update(
        self, user_id: UUID, tenant_id: UUID, **kwargs
    ) -> Optional[User]:
        await self.db.execute(
            update(User)
            .where(and_(User.id == user_id, User.tenant_id == tenant_id))
            .values(**kwargs)
        )
        return await self.get_by_id(user_id, tenant_id)

    async def soft_delete(self, user_id: UUID, tenant_id: UUID) -> bool:
        from datetime import UTC, datetime

        result = await self.db.execute(
            update(User)
            .where(
                and_(
                    User.id == user_id,
                    User.tenant_id == tenant_id,
                    User.deleted_at.is_(None),
                )
            )
            .values(deleted_at=datetime.now(UTC), is_active=False)
        )
        return result.rowcount > 0

    async def set_roles(
        self, user_id: UUID, tenant_id: UUID, role_names: list[str]
    ) -> None:
        """Replace all role associations for a user."""
        roles_result = await self.db.execute(
            select(Role).where(Role.name.in_(role_names))
        )
        roles = roles_result.scalars().all()

        # Remove existing associations
        await self.db.execute(
            delete(user_roles_table).where(
                user_roles_table.c.user_id == user_id
            )
        )

        # Insert new associations
        for role in roles:
            await self.db.execute(
                insert(user_roles_table).values(
                    user_id=user_id, role_id=role.id
                )
            )

        await self.db.flush()

    async def refresh_roles(self, user: User) -> None:
        await self.db.refresh(user, attribute_names=["roles"])
