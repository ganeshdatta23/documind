"""Search module schemas."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    document_ids: Optional[list[UUID]] = None
    tags: Optional[list[str]] = None
    file_types: Optional[list[str]] = None
    top_k: int = Field(default=10, ge=1, le=50)
    search_mode: str = Field(default="hybrid")  # hybrid | vector | bm25
    metadata_filters: Optional[dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "query": "What are the refund policies?",
                "top_k": 10,
                "search_mode": "hybrid",
            }
        }


class ChunkResult(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_title: str
    document_filename: str
    file_type: str
    content: str
    page_number: Optional[int]
    chunk_index: int
    vector_score: float
    bm25_score: float
    rrf_score: float
    rerank_score: Optional[float]
    excerpt: str  # highlighted snippet


class SearchResponse(BaseModel):
    query: str
    results: list[ChunkResult]
    total_results: int
    retrieval_latency_ms: int
    search_mode: str


class DocumentSearchResult(BaseModel):
    document_id: UUID
    title: str
    filename: str
    file_type: str
    status: str
    relevance_score: float
    matching_chunks: int
    top_excerpt: str
    created_at: datetime
