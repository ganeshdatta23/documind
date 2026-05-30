"""Conversation summary and cleanup workers."""
from celery_app import celery_app


@celery_app.task(name="workers.summary_worker.summarize_conversation", queue="summaries")
def summarize_conversation(conversation_id: str) -> dict:
    """Summarize old conversation messages to reduce context window usage."""
    # TODO: Phase 4 implementation
    return {"status": "skipped"}


@celery_app.task(name="workers.cleanup_worker.cleanup_soft_deleted", queue="maintenance")
def cleanup_soft_deleted() -> dict:
    """Remove permanently deleted data from storage and DB."""
    # TODO: Phase 5 implementation
    return {"status": "skipped"}


@celery_app.task(name="workers.cleanup_worker.aggregate_usage_metrics", queue="maintenance")
def aggregate_usage_metrics() -> dict:
    """Aggregate usage metrics into hourly/daily summaries."""
    # TODO: Phase 5 implementation
    return {"status": "skipped"}
