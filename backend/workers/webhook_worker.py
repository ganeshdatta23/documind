"""Webhook delivery worker stub — full implementation in Phase 5."""
from celery_app import celery_app


@celery_app.task(name="workers.webhook_worker.deliver_webhook", queue="webhooks")
def deliver_webhook(webhook_id: str, event_type: str, payload: dict) -> dict:
    """Deliver webhook event to configured URL with HMAC signature."""
    # TODO: Phase 5 implementation
    return {"status": "skipped", "reason": "not_implemented"}
