"""Tenant repository — thin session wrapper over queries.tenants."""
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from models import Tenant
from queries import count_from
from queries.tenants import (
    select_tenant,
    select_tenant_by_slug,
    select_tenant_document_count,
    select_tenant_storage_used,
    select_tenant_user_count,
    select_tenants,
    soft_delete_tenant,
    update_tenant_fields,
)


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
        result = await self.db.execute(select_tenant(tenant_id))
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Tenant]:
        result = await self.db.execute(select_tenant_by_slug(slug))
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        status: Optional[str] = None,
        plan: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Tenant], int]:
        base = select_tenants(status=status, plan=plan)
        total = await count_from(self.db, base.subquery())
        result = await self.db.execute(base.limit(limit).offset(offset))
        return list(result.scalars().all()), total

    async def update(self, tenant_id: UUID, **kwargs) -> Optional[Tenant]:
        await self.db.execute(update_tenant_fields(tenant_id, **kwargs))
        return await self.get_by_id(tenant_id)

    async def soft_delete(self, tenant_id: UUID) -> bool:
        result = await self.db.execute(soft_delete_tenant(tenant_id))
        return result.rowcount > 0

    async def get_user_count(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_tenant_user_count(tenant_id)) or 0

    async def get_document_count(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_tenant_document_count(tenant_id)) or 0

    async def get_storage_used(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_tenant_storage_used(tenant_id)) or 0
