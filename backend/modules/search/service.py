"""Search service — wraps the RAG retriever with caching and result formatting."""
import hashlib
import json
import time
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from integrations.ai.embedding_client import EmbeddingClient
from modules.search.schemas import ChunkResult, SearchResponse
from rag.retriever import HybridRetriever

logger = structlog.get_logger(__name__)

SEARCH_CACHE_TTL = 300  # 5 minutes


class SearchService:
    def __init__(self, db: AsyncSession, redis) -> None:
        self.db = db
        self.redis = redis

    async def search(
        self,
        query: str,
        tenant_id: UUID,
        *,
        document_ids: Optional[list[UUID]] = None,
        top_k: int = 10,
        search_mode: str = "hybrid",
        metadata_filters: Optional[dict] = None,
    ) -> SearchResponse:
        # Try cache
        cache_key = self._cache_key(query, tenant_id, document_ids, top_k, search_mode)
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                logger.debug("search.cache_hit", query=query[:50])
                return SearchResponse.model_validate_json(cached)

        t_start = time.time()
        embedding_client = EmbeddingClient(redis=self.redis)
        retriever = HybridRetriever(db=self.db, embedding_client=embedding_client)

        chunks = await retriever.retrieve(
            query=query,
            tenant_id=tenant_id,
            document_ids=document_ids,
            metadata_filters=metadata_filters,
            top_k=top_k,
        )
        latency_ms = int((time.time() - t_start) * 1000)

        results = [
            ChunkResult(
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                document_title=c.document_title,
                document_filename=c.file_name,
                file_type=c.file_name.rsplit(".", 1)[-1].lower() if "." in c.file_name else "unknown",
                content=c.content,
                page_number=c.page_number,
                chunk_index=c.chunk_index,
                vector_score=round(c.vector_score, 4),
                bm25_score=round(c.bm25_score, 4),
                rrf_score=round(c.rrf_score, 6),
                rerank_score=round(c.rerank_score, 4) if c.rerank_score else None,
                excerpt=self._make_excerpt(c.content, query),
            )
            for c in chunks
        ]

        response = SearchResponse(
            query=query,
            results=results,
            total_results=len(results),
            retrieval_latency_ms=latency_ms,
            search_mode=search_mode,
        )

        # Cache result
        if self.redis:
            await self.redis.setex(cache_key, SEARCH_CACHE_TTL, response.model_dump_json())

        logger.info(
            "search.completed",
            query=query[:80],
            tenant_id=str(tenant_id),
            result_count=len(results),
            latency_ms=latency_ms,
        )
        return response

    def _cache_key(
        self,
        query: str,
        tenant_id: UUID,
        doc_ids: Optional[list[UUID]],
        top_k: int,
        mode: str,
    ) -> str:
        parts = f"{tenant_id}:{query}:{doc_ids}:{top_k}:{mode}"
        return f"search:{hashlib.md5(parts.encode()).hexdigest()}"

    def _make_excerpt(self, content: str, query: str, max_len: int = 300) -> str:
        """Return a context window around the first query term occurrence."""
        lower_content = content.lower()
        first_term = query.lower().split()[0] if query.split() else ""
        idx = lower_content.find(first_term)
        if idx == -1:
            return content[:max_len] + ("..." if len(content) > max_len else "")
        start = max(0, idx - 80)
        end = min(len(content), idx + max_len)
        excerpt = content[start:end]
        if start > 0:
            excerpt = "..." + excerpt
        if end < len(content):
            excerpt += "..."
        return excerpt
