"""
Webhook delivery worker.

Delivers a signed event payload to a tenant's configured endpoint with HMAC-SHA256
signing, exponential-backoff retries, and consecutive-failure tracking that
auto-disables a chronically failing endpoint.
"""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import structlog

from celery_app import celery_app
from config import settings
from workers._async import run_async

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    name="workers.webhook_worker.deliver_webhook",
    queue="webhooks",
    max_retries=settings.WEBHOOK_MAX_RETRIES,
    default_retry_delay=30,
)
def deliver_webhook(self, webhook_id: str, event_type: str, payload: dict) -> dict:
    """Sign and POST an event to a configured webhook endpoint."""
    return run_async(_deliver_async(self, webhook_id, event_type, payload))


async def _deliver_async(task, webhook_id: str, event_type: str, payload: dict) -> dict:
    import httpx
    from sqlalchemy import update

    from database import async_session_factory
    from models import Webhook
    from security import sign_webhook_payload

    wh_id = UUID(webhook_id)

    async with async_session_factory() as db:
        webhook = await db.get(Webhook, wh_id)
        if not webhook or not webhook.is_active or webhook.deleted_at is not None:
            return {"status": "skipped", "reason": "webhook_inactive"}
        if event_type not in (webhook.events or []):
            return {"status": "skipped", "reason": "event_not_subscribed"}

        envelope = {
            "id": str(wh_id),
            "event": event_type,
            "created_at": datetime.now(UTC).isoformat(),
            "data": payload,
        }
        signature = sign_webhook_payload(envelope, webhook.secret)

        try:
            async with httpx.AsyncClient(timeout=settings.WEBHOOK_TIMEOUT_SECONDS) as client:
                resp = await client.post(
                    webhook.url,
                    json=envelope,
                    headers={
                        "Content-Type": "application/json",
                        "X-DocuMind-Event": event_type,
                        "X-DocuMind-Signature": signature,
                        "User-Agent": "DocuMind-Webhooks/1.0",
                    },
                )
            resp.raise_for_status()
        except Exception as exc:
            new_failures = (webhook.failure_count or 0) + 1
            disable = new_failures >= settings.WEBHOOK_DISABLE_AFTER_FAILURES
            await db.execute(
                update(Webhook)
                .where(Webhook.id == wh_id)
                .values(
                    failure_count=new_failures,
                    last_failure_at=datetime.now(UTC),
                    is_active=not disable and webhook.is_active,
                )
            )
            await db.commit()
            logger.warning(
                "webhook.delivery_failed",
                webhook_id=webhook_id,
                event=event_type,
                failures=new_failures,
                disabled=disable,
                error=str(exc),
            )
            if not disable and task.request.retries < task.max_retries:
                raise task.retry(exc=exc, countdown=30 * (2 ** task.request.retries))
            return {"status": "failed", "failures": new_failures, "disabled": disable}

        # Success — reset failure counter, stamp success.
        await db.execute(
            update(Webhook)
            .where(Webhook.id == wh_id)
            .values(failure_count=0, last_success_at=datetime.now(UTC))
        )
        await db.commit()

    logger.info("webhook.delivered", webhook_id=webhook_id, event=event_type)
    return {"status": "delivered"}
