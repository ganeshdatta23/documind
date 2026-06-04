"""Ingestion repository — data access for ingestion_jobs."""
from __future__ import annotations  # `list()` method must not shadow list[...] hints

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import IngestionJob


class IngestionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        tenant_id: UUID,
        *,
        document_id: Optional[UUID] = None,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[IngestionJob], int]:
        conditions = [IngestionJob.tenant_id == tenant_id]
        if document_id:
            conditions.append(IngestionJob.document_id == document_id)
        if status:
            conditions.append(IngestionJob.status == status)

        base = select(IngestionJob).where(and_(*conditions)).order_by(
            IngestionJob.created_at.desc()
        )
        total = await self.db.scalar(select(func.count()).select_from(base.subquery()))
        result = await self.db.execute(base.limit(limit).offset(offset))
        return list(result.scalars().all()), total or 0

    async def get(self, job_id: UUID, tenant_id: UUID) -> Optional[IngestionJob]:
        result = await self.db.execute(
            select(IngestionJob).where(and_(
                IngestionJob.id == job_id,
                IngestionJob.tenant_id == tenant_id,
            ))
        )
        return result.scalar_one_or_none()
