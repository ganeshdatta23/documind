"""
Domain event emitter.

Finds active webhook subscriptions for a tenant/event and enqueues a delivery
task for each. Failures to enqueue are swallowed (logged) so emitting an event
never breaks the primary request/worker flow.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Webhook

logger = structlog.get_logger(__name__)


# Canonical event names
class Events:
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_READY = "document.ready"
    DOCUMENT_FAILED = "document.failed"
    DOCUMENT_DELETED = "document.deleted"


async def emit_event(
    db: AsyncSession,
    tenant_id: UUID,
    event_type: str,
    payload: dict[str, Any],
) -> int:
    """Enqueue delivery of `event_type` to every subscribed, active webhook.

    Returns the number of deliveries enqueued.
    """
    try:
        webhooks = (
            await db.execute(
                select(Webhook).where(
                    and_(
                        Webhook.tenant_id == tenant_id,
                        Webhook.is_active.is_(True),
                        Webhook.deleted_at.is_(None),
                        Webhook.events.contains([event_type]),
                    )
                )
            )
        ).scalars().all()
    except Exception as exc:
        logger.warning("events.lookup_failed", event=event_type, error=str(exc))
        return 0

    if not webhooks:
        return 0

    from workers.webhook_worker import deliver_webhook

    enqueued = 0
    for wh in webhooks:
        try:
            deliver_webhook.apply_async(
                kwargs={
                    "webhook_id": str(wh.id),
                    "event_type": event_type,
                    "payload": payload,
                },
                queue="webhooks",
            )
            enqueued += 1
        except Exception as exc:
            logger.warning("events.enqueue_failed", webhook_id=str(wh.id), error=str(exc))

    logger.info("events.emitted", event=event_type, tenant_id=str(tenant_id), deliveries=enqueued)
    return enqueued
