"""Analytics repository — all queries via SQLAlchemy ORM, never raw SQL."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Conversation, Document, Message, User


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_document_counts_by_status(
        self, tenant_id: UUID
    ) -> dict[str, int]:
        """ORM aggregate: count documents grouped by status."""
        stmt = (
            select(Document.status, func.count(Document.id).label("cnt"))
            .where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.deleted_at.is_(None),
                )
            )
            .group_by(Document.status)
        )
        rows = (await self.db.execute(stmt)).all()
        return {row.status: row.cnt for row in rows}

    async def get_user_count(self, tenant_id: UUID) -> int:
        stmt = (
            select(func.count(User.id))
            .where(
                and_(
                    User.tenant_id == tenant_id,
                    User.deleted_at.is_(None),
                )
            )
        )
        return await self.db.scalar(stmt) or 0

    async def get_conversation_count_since(
        self, tenant_id: UUID, since: datetime
    ) -> int:
        stmt = (
            select(func.count(Conversation.id))
            .where(
                and_(
                    Conversation.tenant_id == tenant_id,
                    Conversation.created_at >= since,
                    Conversation.deleted_at.is_(None),
                )
            )
        )
        return await self.db.scalar(stmt) or 0

    async def get_message_count_since(
        self,
        tenant_id: UUID,
        since: datetime,
        role: Optional[str] = "user",
    ) -> int:
        conditions = [
            Message.tenant_id == tenant_id,
            Message.created_at >= since,
        ]
        if role:
            conditions.append(Message.role == role)

        stmt = select(func.count(Message.id)).where(and_(*conditions))
        return await self.db.scalar(stmt) or 0

    async def get_total_storage_used(self, tenant_id: UUID) -> int:
        stmt = (
            select(func.coalesce(func.sum(Document.file_size_bytes), 0))
            .where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.deleted_at.is_(None),
                )
            )
        )
        return await self.db.scalar(stmt) or 0

    async def get_daily_upload_counts(
        self, tenant_id: UUID, days: int = 30
    ) -> list[dict]:
        """Return [{date, count}] for the last N days using ORM date_trunc."""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = (
            select(
                func.date_trunc("day", Document.created_at).label("day"),
                func.count(Document.id).label("cnt"),
            )
            .where(
                and_(
                    Document.tenant_id == tenant_id,
                    Document.created_at >= since,
                    Document.deleted_at.is_(None),
                )
            )
            .group_by(func.date_trunc("day", Document.created_at))
            .order_by(func.date_trunc("day", Document.created_at))
        )
        rows = (await self.db.execute(stmt)).all()
        return [{"date": row.day.date().isoformat(), "count": row.cnt} for row in rows]

    async def get_avg_response_latency_ms(self, tenant_id: UUID) -> Optional[float]:
        """Average RAG response latency from assistant messages."""
        stmt = (
            select(func.avg(Message.latency_ms))
            .where(
                and_(
                    Message.tenant_id == tenant_id,
                    Message.role == "assistant",
                    Message.latency_ms.is_not(None),
                )
            )
        )
        result = await self.db.scalar(stmt)
        return round(float(result), 1) if result else None
