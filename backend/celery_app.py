"""
DocuMind Celery Application — Worker task registry and configuration.
"""
from __future__ import annotations

from celery import Celery

from config import settings

celery_app = Celery(
    "documind",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "workers.ingestion_worker",
        "workers.embedding_worker",
        "workers.webhook_worker",
        "workers.summary_worker",
        "workers.cleanup_worker",
    ],
)

# NOTE: task_routes below key off the *registered task name* prefix, so the
# maintenance tasks (named "workers.cleanup_worker.*") and the summary task
# (named "workers.summary_worker.*") are routed to their dedicated queues.

celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,

    # Retry settings
    task_max_retries=settings.CELERY_MAX_RETRIES,
    task_default_retry_delay=60,  # 1 minute base delay

    # Reliability
    task_acks_late=True,           # Ack after task completes (not before)
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # One task at a time per worker (fair dispatch)

    # Results
    result_expires=86400,          # Results expire after 24 hours

    # Routing — separate queues for different priority/resource needs
    task_routes={
        "workers.ingestion_worker.*": {"queue": "ingestion"},
        "workers.embedding_worker.*": {"queue": "embedding"},
        "workers.webhook_worker.*": {"queue": "webhooks"},
        "workers.summary_worker.*": {"queue": "summaries"},
        "workers.cleanup_worker.*": {"queue": "maintenance"},
    },

    # Beat schedule (periodic tasks)
    beat_schedule={
        "cleanup-deleted-data": {
            "task": "workers.cleanup_worker.cleanup_soft_deleted",
            "schedule": 86400.0,  # Daily
            "options": {"queue": "maintenance"},
        },
        "generate-usage-reports": {
            "task": "workers.cleanup_worker.aggregate_usage_metrics",
            "schedule": 3600.0,  # Hourly
            "options": {"queue": "maintenance"},
        },
    },
)
