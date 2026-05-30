"""Chat module schemas."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None
    document_ids: list[UUID] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)


class ConversationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    title: Optional[str]
    summary: Optional[str]
    document_ids: list[UUID]
    message_count: int
    token_count: int
    last_message_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    metadata_filters: Optional[dict[str, Any]] = None


class CitationSchema(BaseModel):
    index: int
    chunk_id: UUID
    document_id: UUID
    document_title: str
    document_filename: str
    page_number: Optional[int]
    excerpt: str


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations: list[CitationSchema]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    total_tokens: Optional[int]
    model_name: Optional[str]
    latency_ms: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
