"""Webhook repository — data access for the webhooks table."""
from __future__ import annotations  # `list()` method must not shadow list[...] hints

from datetime import UTC, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Webhook


class WebhookRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Webhook:
        wh = Webhook(**kwargs)
        self.db.add(wh)
        await self.db.flush()
        await self.db.refresh(wh)
        return wh

    async def get(self, webhook_id: UUID, tenant_id: UUID) -> Optional[Webhook]:
        result = await self.db.execute(
            select(Webhook).where(and_(
                Webhook.id == webhook_id,
                Webhook.tenant_id == tenant_id,
                Webhook.deleted_at.is_(None),
            ))
        )
        return result.scalar_one_or_none()

    async def list(self, tenant_id: UUID) -> tuple[list[Webhook], int]:
        base = select(Webhook).where(and_(
            Webhook.tenant_id == tenant_id, Webhook.deleted_at.is_(None)
        )).order_by(Webhook.created_at.desc())
        total = await self.db.scalar(select(func.count()).select_from(base.subquery()))
        result = await self.db.execute(base)
        return list(result.scalars().all()), total or 0

    async def update(self, webhook_id: UUID, tenant_id: UUID, **kwargs) -> Optional[Webhook]:
        await self.db.execute(
            update(Webhook)
            .where(and_(Webhook.id == webhook_id, Webhook.tenant_id == tenant_id))
            .values(**kwargs)
        )
        return await self.get(webhook_id, tenant_id)

    async def soft_delete(self, webhook_id: UUID, tenant_id: UUID) -> bool:
        result = await self.db.execute(
            update(Webhook)
            .where(and_(
                Webhook.id == webhook_id,
                Webhook.tenant_id == tenant_id,
                Webhook.deleted_at.is_(None),
            ))
            .values(deleted_at=datetime.now(UTC), is_active=False)
        )
        return (result.rowcount or 0) > 0
