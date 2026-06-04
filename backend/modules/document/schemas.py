"""Document module schemas — request/response DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentUploadRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    custom_metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    uploaded_by: UUID
    title: str
    description: Optional[str]
    file_name: str
    file_type: str
    mime_type: str
    file_size_bytes: int
    status: str
    tags: list[str]
    custom_metadata: dict[str, Any]
    page_count: Optional[int]
    word_count: Optional[int]
    language: Optional[str]
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class DocumentStatusResponse(BaseModel):
    id: UUID
    status: str
    progress: Optional[dict] = None
    error_message: Optional[str] = None


class DocumentUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_metadata: Optional[dict[str, Any]] = None
