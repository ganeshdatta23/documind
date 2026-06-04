"""
Cleanup & maintenance workers.

- cleanup_soft_deleted: permanently removes rows that have been soft-deleted
  longer than the retention window, and reclaims their storage objects.
- aggregate_usage_metrics: snapshots per-tenant usage into tenant.metadata so
  the dashboard/billing can read historical usage cheaply.

Both are scheduled via Celery beat (see celery_app.py).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog

from celery_app import celery_app
from config import settings
from workers._async import run_async

logger = structlog.get_logger(__name__)


@celery_app.task(name="workers.cleanup_worker.cleanup_soft_deleted", queue="maintenance")
def cleanup_soft_deleted() -> dict:
    """Hard-delete soft-deleted records past the retention window."""
    return run_async(_cleanup_soft_deleted_async())


async def _cleanup_soft_deleted_async() -> dict:
    from sqlalchemy import delete, select

    from database import async_session_factory
    from integrations.storage.local import LocalStorageClient
    from models import Conversation, Document, User

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.SOFT_DELETE_RETENTION_DAYS)
    storage = LocalStorageClient()
    removed = {"documents": 0, "conversations": 0, "users": 0, "storage_objects": 0}

    async with async_session_factory() as db:
        # Documents — reclaim storage objects before deleting the rows.
        docs = (
            await db.execute(
                select(Document).where(
                    Document.deleted_at.is_not(None), Document.deleted_at < cutoff
                )
            )
        ).scalars().all()
        for doc in docs:
            try:
                await storage.delete(doc.storage_path)
                removed["storage_objects"] += 1
            except Exception as exc:  # storage best-effort; never block the purge
                logger.warning("cleanup.storage_delete_failed", document_id=str(doc.id), error=str(exc))
        if docs:
            await db.execute(delete(Document).where(Document.id.in_([d.id for d in docs])))
            removed["documents"] = len(docs)

        # Conversations (messages cascade via FK ON DELETE CASCADE).
        conv_result = await db.execute(
            delete(Conversation).where(
                Conversation.deleted_at.is_not(None), Conversation.deleted_at < cutoff
            )
        )
        removed["conversations"] = conv_result.rowcount or 0

        # Users.
        user_result = await db.execute(
            delete(User).where(User.deleted_at.is_not(None), User.deleted_at < cutoff)
        )
        removed["users"] = user_result.rowcount or 0

        await db.commit()

    logger.info("cleanup.completed", **removed, retention_days=settings.SOFT_DELETE_RETENTION_DAYS)
    return {"status": "ok", **removed}


@celery_app.task(name="workers.cleanup_worker.aggregate_usage_metrics", queue="maintenance")
def aggregate_usage_metrics() -> dict:
    """Snapshot per-tenant usage into tenant.metadata for reporting."""
    return run_async(_aggregate_usage_metrics_async())


async def _aggregate_usage_metrics_async() -> dict:
    from sqlalchemy import select, update

    from database import async_session_factory
    from models import Tenant
    from queries.analytics import (
        select_active_user_count,
        select_message_count_since,
        select_total_storage_bytes,
    )
    from queries.documents import select_document_count

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    snapshots = 0

    async with async_session_factory() as db:
        tenant_ids = (
            await db.execute(select(Tenant.id).where(Tenant.deleted_at.is_(None)))
        ).scalars().all()

        for tid in tenant_ids:
            usage = {
                "as_of": now.isoformat(),
                "storage_used_bytes": await db.scalar(select_total_storage_bytes(tid)) or 0,
                "document_count": await db.scalar(select_document_count(tid)) or 0,
                "user_count": await db.scalar(select_active_user_count(tid)) or 0,
                "api_calls_this_month": await db.scalar(
                    select_message_count_since(tid, month_start, role="user")
                ) or 0,
            }
            # JSONB column — merge so we don't clobber other metadata keys.
            await db.execute(
                update(Tenant)
                .where(Tenant.id == tid)
                .values(metadata_=Tenant.metadata_.op("||")({"usage_snapshot": usage}))
            )
            snapshots += 1

        await db.commit()

    logger.info("usage.aggregated", tenants=snapshots)
    return {"status": "ok", "tenants": snapshots}
