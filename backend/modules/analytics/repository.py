"""Analytics repository — thin session wrapper over queries.analytics."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from queries.analytics import (
    select_active_user_count,
    select_avg_response_latency,
    select_conversation_count_since,
    select_daily_upload_counts,
    select_document_counts_by_status,
    select_message_count_since,
    select_total_storage_bytes,
)


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_document_counts_by_status(self, tenant_id: UUID) -> dict[str, int]:
        rows = (await self.db.execute(select_document_counts_by_status(tenant_id))).all()
        return {row.status: row.cnt for row in rows}

    async def get_user_count(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_active_user_count(tenant_id)) or 0

    async def get_conversation_count_since(self, tenant_id: UUID, since: datetime) -> int:
        return await self.db.scalar(select_conversation_count_since(tenant_id, since)) or 0

    async def get_message_count_since(
        self, tenant_id: UUID, since: datetime, role: Optional[str] = "user"
    ) -> int:
        return await self.db.scalar(select_message_count_since(tenant_id, since, role=role)) or 0

    async def get_total_storage_used(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_total_storage_bytes(tenant_id)) or 0

    async def get_daily_upload_counts(self, tenant_id: UUID, days: int = 30) -> list[dict]:
        rows = (await self.db.execute(select_daily_upload_counts(tenant_id, days))).all()
        return [{"date": row.day.date().isoformat(), "count": row.cnt} for row in rows]

    async def get_avg_response_latency_ms(self, tenant_id: UUID) -> Optional[float]:
        result = await self.db.scalar(select_avg_response_latency(tenant_id))
        return round(float(result), 1) if result else None
