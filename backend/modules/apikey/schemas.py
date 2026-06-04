"""API key module schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class APIKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=lambda: ["read"])
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)

    model_config = {"extra": "forbid"}


class APIKeyResponse(BaseModel):
    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyCreatedResponse(APIKeyResponse):
    """Returned exactly once on creation — includes the full secret key."""
    api_key: str


class APIKeyListResponse(BaseModel):
    items: list[APIKeyResponse]
    total: int
