"""Admin repository — platform-wide ORM aggregations (superadmin only)."""
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Document, Tenant, User


class AdminRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_platform_stats(self) -> dict:
        tenant_count = await self.db.scalar(
            select(func.count(Tenant.id)).where(Tenant.deleted_at.is_(None))
        )
        user_count = await self.db.scalar(
            select(func.count(User.id)).where(User.deleted_at.is_(None))
        )
        doc_count = await self.db.scalar(
            select(func.count(Document.id)).where(Document.deleted_at.is_(None))
        )
        storage_total = await self.db.scalar(
            select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(
                Document.deleted_at.is_(None)
            )
        )
        docs_failed = await self.db.scalar(
            select(func.count(Document.id)).where(
                and_(
                    Document.status == "failed",
                    Document.deleted_at.is_(None),
                )
            )
        )
        return {
            "tenants": tenant_count or 0,
            "users": user_count or 0,
            "documents": {
                "total": doc_count or 0,
                "failed": docs_failed or 0,
            },
            "storage_bytes": storage_total or 0,
        }
