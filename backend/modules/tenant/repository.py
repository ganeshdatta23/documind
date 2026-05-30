"""Tenant repository — tenant CRUD with slug uniqueness enforcement."""
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Document, Tenant, User


class TenantRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Tenant:
        tenant = Tenant(**kwargs)
        self.db.add(tenant)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(
                and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
            )
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(
                and_(Tenant.slug == slug, Tenant.deleted_at.is_(None))
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        status: Optional[str] = None,
        plan: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Tenant], int]:
        q = select(Tenant).where(Tenant.deleted_at.is_(None))
        if status:
            q = q.where(Tenant.status == status)
        if plan:
            q = q.where(Tenant.plan == plan)

        total = await self.db.scalar(select(func.count()).select_from(q.subquery()))
        result = await self.db.execute(
            q.order_by(Tenant.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total or 0

    async def update(self, tenant_id: UUID, **kwargs) -> Optional[Tenant]:
        await self.db.execute(
            update(Tenant).where(Tenant.id == tenant_id).values(**kwargs)
        )
        return await self.get_by_id(tenant_id)

    async def soft_delete(self, tenant_id: UUID) -> bool:
        from datetime import UTC, datetime

        result = await self.db.execute(
            update(Tenant)
            .where(and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None)))
            .values(deleted_at=datetime.now(UTC), status="deleted")
        )
        return result.rowcount > 0

    async def get_user_count(self, tenant_id: UUID) -> int:
        result = await self.db.scalar(
            select(func.count()).where(
                and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
            )
        )
        return result or 0

    async def get_document_count(self, tenant_id: UUID) -> int:
        result = await self.db.scalar(
            select(func.count()).where(
                and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
            )
        )
        return result or 0

    async def get_storage_used(self, tenant_id: UUID) -> int:
        result = await self.db.scalar(
            select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(
                and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
            )
        )
        return result or 0
