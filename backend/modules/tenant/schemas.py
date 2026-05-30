"""Tenant module Pydantic schemas — fully validated request/response DTOs."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TenantCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    plan: str = Field(default="free")
    max_storage_bytes: int = Field(default=1073741824, ge=0)
    max_documents: int = Field(default=100, ge=1)
    max_users: int = Field(default=5, ge=1)
    max_api_calls_month: int = Field(default=1000, ge=0)
    settings: dict[str, Any] = Field(default_factory=dict)

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: str) -> str:
        allowed = {"free", "starter", "professional", "enterprise"}
        if v not in allowed:
            raise ValueError(f"Plan must be one of: {', '.join(allowed)}")
        return v


class TenantUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    plan: Optional[str] = None
    status: Optional[str] = None
    max_storage_bytes: Optional[int] = Field(None, ge=0)
    max_documents: Optional[int] = Field(None, ge=1)
    max_users: Optional[int] = Field(None, ge=1)
    max_api_calls_month: Optional[int] = Field(None, ge=0)
    settings: Optional[dict[str, Any]] = None

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"free", "starter", "professional", "enterprise"}
        if v not in allowed:
            raise ValueError(f"Plan must be one of: {', '.join(allowed)}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"active", "suspended", "deleted"}
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    status: str
    max_storage_bytes: int
    max_documents: int
    max_users: int
    max_api_calls_month: int
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantListResponse(BaseModel):
    items: list[TenantResponse]
    total: int
    page: int
    page_size: int


class TenantUsageResponse(BaseModel):
    tenant_id: UUID
    storage_used_bytes: int
    storage_limit_bytes: int
    document_count: int
    document_limit: int
    user_count: int
    user_limit: int
    api_calls_this_month: int
    api_call_limit: int
