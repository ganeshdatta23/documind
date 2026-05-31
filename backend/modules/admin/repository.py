"""Admin repository — thin session wrapper over queries.analytics (platform-wide)."""
from sqlalchemy.ext.asyncio import AsyncSession

from queries.analytics import (
    select_platform_document_count,
    select_platform_tenant_count,
    select_platform_total_storage,
    select_platform_user_count,
)


class AdminRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_platform_stats(self) -> dict:
        tenant_count = await self.db.scalar(select_platform_tenant_count()) or 0
        user_count = await self.db.scalar(select_platform_user_count()) or 0
        doc_count = await self.db.scalar(select_platform_document_count()) or 0
        storage_total = await self.db.scalar(select_platform_total_storage()) or 0
        docs_failed = await self.db.scalar(select_platform_document_count(status="failed")) or 0

        return {
            "tenants": tenant_count,
            "users": user_count,
            "documents": {
                "total": doc_count,
                "failed": docs_failed,
            },
            "storage_bytes": storage_total,
        }
