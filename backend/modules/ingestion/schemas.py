"""Ingestion module schemas — ingestion job tracking DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class IngestionJobResponse(BaseModel):
    id: UUID
    document_id: UUID
    job_type: str
    status: str
    celery_task_id: Optional[str]
    attempt_count: int
    max_attempts: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    progress: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestionJobListResponse(BaseModel):
    items: list[IngestionJobResponse]
    total: int
    page: int
    page_size: int
