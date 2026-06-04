"""Audit module schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    actor_id: Optional[UUID]
    actor_type: str
    action: str
    resource_type: str
    resource_id: Optional[UUID]
    ip_address: Optional[str]
    user_agent: Optional[str]
    request_id: Optional[str]
    metadata: dict[str, Any]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
