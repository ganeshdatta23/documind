"""Analytics service — aggregates metrics via repository, applies business logic."""
from datetime import datetime, timezone
from uuid import UUID

from modules.analytics.repository import AnalyticsRepository


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self.repo = repo

    async def get_overview(self, tenant_id: UUID) -> dict:
        docs_by_status = await self.repo.get_document_counts_by_status(tenant_id)
        total_docs = sum(docs_by_status.values())
        processing_count = sum(
            docs_by_status.get(s, 0)
            for s in ("parsing", "chunking", "embedding")
        )

        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        return {
            "documents": {
                "total": total_docs,
                "ready": docs_by_status.get("ready", 0),
                "pending": docs_by_status.get("pending", 0),
                "failed": docs_by_status.get("failed", 0),
                "processing": processing_count,
            },
            "users": {
                "total": await self.repo.get_user_count(tenant_id),
            },
            "conversations": {
                "this_month": await self.repo.get_conversation_count_since(
                    tenant_id, month_start
                ),
            },
            "queries": {
                "today": await self.repo.get_message_count_since(
                    tenant_id, today_start, role="user"
                ),
            },
            "storage": {
                "used_bytes": await self.repo.get_total_storage_used(tenant_id),
            },
            "performance": {
                "avg_response_latency_ms": await self.repo.get_avg_response_latency_ms(
                    tenant_id
                ),
            },
        }

    async def get_activity(self, tenant_id: UUID, days: int = 30) -> list[dict]:
        return await self.repo.get_daily_upload_counts(tenant_id, days)
