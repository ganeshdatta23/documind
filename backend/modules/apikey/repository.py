"""API key repository — data access for the api_keys table."""
from __future__ import annotations  # `list()` method must not shadow list[...] hints

from datetime import UTC, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import APIKey


class APIKeyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> APIKey:
        key = APIKey(**kwargs)
        self.db.add(key)
        await self.db.flush()
        await self.db.refresh(key)
        return key

    async def list(self, tenant_id: UUID) -> tuple[list[APIKey], int]:
        base = select(APIKey).where(
            and_(APIKey.tenant_id == tenant_id, APIKey.deleted_at.is_(None))
        ).order_by(APIKey.created_at.desc())
        total = await self.db.scalar(
            select(func.count()).select_from(base.subquery())
        )
        result = await self.db.execute(base)
        return list(result.scalars().all()), total or 0

    async def get_active_by_hash(self, key_hash: str) -> Optional[APIKey]:
        """Active, non-expired key for authentication."""
        result = await self.db.execute(
            select(APIKey).where(
                and_(
                    APIKey.key_hash == key_hash,
                    APIKey.is_active.is_(True),
                    APIKey.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, key_id: UUID, tenant_id: UUID) -> bool:
        result = await self.db.execute(
            update(APIKey)
            .where(and_(
                APIKey.id == key_id,
                APIKey.tenant_id == tenant_id,
                APIKey.deleted_at.is_(None),
            ))
            .values(is_active=False, deleted_at=datetime.now(UTC))
        )
        return (result.rowcount or 0) > 0

    async def touch_last_used(self, key_id: UUID) -> None:
        await self.db.execute(
            update(APIKey).where(APIKey.id == key_id).values(last_used_at=datetime.now(UTC))
        )
