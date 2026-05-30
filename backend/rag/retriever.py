"""Hybrid Retriever — Vector search + BM25 + RRF fusion + reranking."""
import asyncio
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings

logger = structlog.get_logger(__name__)


@dataclass
class ScoredChunk:
    chunk_id: UUID
    document_id: UUID
    content: str
    document_title: str
    file_name: str
    page_number: Optional[int]
    chunk_index: int
    vector_score: float = 0.0
    bm25_score: float = 0.0
    rrf_score: float = 0.0
    rerank_score: float = 0.0
    source: str = "hybrid"
    metadata: dict = field(default_factory=dict)


class HybridRetriever:
    """Combines pgvector semantic search with PostgreSQL BM25 using RRF fusion."""

    def __init__(self, db: AsyncSession, embedding_client) -> None:
        self.db = db
        self.embedding_client = embedding_client

    async def retrieve(
        self,
        query: str,
        tenant_id: UUID,
        *,
        document_ids: Optional[list[UUID]] = None,
        metadata_filters: Optional[dict] = None,
        top_k: int = 5,
    ) -> list[ScoredChunk]:
        """
        Full hybrid retrieval pipeline:
        1. Parallel vector + BM25 search
        2. RRF fusion
        3. Reranking (if configured)
        """
        # Embed query
        query_embedding = await self.embedding_client.embed_query(query)

        # Run both searches in parallel
        vector_results, bm25_results = await asyncio.gather(
            self._vector_search(query_embedding, tenant_id, document_ids, settings.VECTOR_SEARCH_TOP_K),
            self._bm25_search(query, tenant_id, document_ids, settings.BM25_SEARCH_TOP_K),
        )

        logger.debug(
            "retrieval.raw_results",
            vector_count=len(vector_results),
            bm25_count=len(bm25_results),
        )

        # RRF fusion
        fused = self._rrf_fusion(vector_results, bm25_results)[:settings.HYBRID_FUSION_TOP_K]

        # Apply metadata post-filters
        if metadata_filters:
            fused = self._apply_metadata_filters(fused, metadata_filters)

        # Rerank (passthrough or Cohere)
        reranked = await self._rerank(query, fused, top_k)

        return reranked

    async def _vector_search(
        self,
        embedding: list[float],
        tenant_id: UUID,
        document_ids: Optional[list[UUID]],
        top_k: int,
    ) -> list[ScoredChunk]:
        """Cosine similarity search via pgvector <=> operator."""
        doc_filter = "AND dc.document_id = ANY(:doc_ids)" if document_ids else ""

        result = await self.db.execute(
            text(f"""
                SELECT
                    dc.id          AS chunk_id,
                    dc.document_id,
                    dc.content,
                    dc.chunk_index,
                    dc.page_number,
                    dc.metadata,
                    d.title        AS document_title,
                    d.file_name,
                    1 - (ce.embedding <=> CAST(:query_vec AS vector)) AS score
                FROM chunk_embeddings ce
                JOIN document_chunks dc ON ce.chunk_id = dc.id
                JOIN documents d ON dc.document_id = d.id
                WHERE
                    ce.tenant_id = :tenant_id
                    AND d.status = 'ready'
                    AND d.deleted_at IS NULL
                    {doc_filter}
                ORDER BY ce.embedding <=> CAST(:query_vec AS vector)
                LIMIT :top_k
            """),
            {
                "query_vec": f"[{','.join(str(v) for v in embedding)}]",
                "tenant_id": str(tenant_id),
                "doc_ids": [str(d) for d in document_ids] if document_ids else None,
                "top_k": top_k,
            }
        )
        rows = result.fetchall()

        chunks = []
        for row in rows:
            chunks.append(ScoredChunk(
                chunk_id=row.chunk_id,
                document_id=row.document_id,
                content=row.content,
                document_title=row.document_title,
                file_name=row.file_name,
                page_number=row.page_number,
                chunk_index=row.chunk_index,
                vector_score=float(row.score),
                source="vector",
                metadata=row.metadata or {},
            ))
        return chunks

    async def _bm25_search(
        self,
        query: str,
        tenant_id: UUID,
        document_ids: Optional[list[UUID]],
        top_k: int,
    ) -> list[ScoredChunk]:
        """PostgreSQL full-text BM25-style search via ts_rank_cd."""
        doc_filter = "AND dc.document_id = ANY(:doc_ids)" if document_ids else ""

        result = await self.db.execute(
            text(f"""
                SELECT
                    dc.id          AS chunk_id,
                    dc.document_id,
                    dc.content,
                    dc.chunk_index,
                    dc.page_number,
                    dc.metadata,
                    d.title        AS document_title,
                    d.file_name,
                    ts_rank_cd(
                        to_tsvector('english', dc.content),
                        plainto_tsquery('english', :query)
                    ) AS score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE
                    dc.tenant_id = :tenant_id
                    AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', :query)
                    AND d.status = 'ready'
                    AND d.deleted_at IS NULL
                    {doc_filter}
                ORDER BY score DESC
                LIMIT :top_k
            """),
            {
                "query": query,
                "tenant_id": str(tenant_id),
                "doc_ids": [str(d) for d in document_ids] if document_ids else None,
                "top_k": top_k,
            }
        )
        rows = result.fetchall()

        chunks = []
        for row in rows:
            chunks.append(ScoredChunk(
                chunk_id=row.chunk_id,
                document_id=row.document_id,
                content=row.content,
                document_title=row.document_title,
                file_name=row.file_name,
                page_number=row.page_number,
                chunk_index=row.chunk_index,
                bm25_score=float(row.score),
                source="bm25",
                metadata=row.metadata or {},
            ))
        return chunks

    def _rrf_fusion(
        self,
        vector_results: list[ScoredChunk],
        bm25_results: list[ScoredChunk],
    ) -> list[ScoredChunk]:
        """Reciprocal Rank Fusion: score(d) = sum(1 / (k + rank(d)))"""
        k = settings.RRF_K
        scores: dict[UUID, float] = {}
        chunk_map: dict[UUID, ScoredChunk] = {}

        for rank, chunk in enumerate(vector_results, start=1):
            scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0.0) + 1.0 / (k + rank)
            chunk_map[chunk.chunk_id] = chunk

        for rank, chunk in enumerate(bm25_results, start=1):
            scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0.0) + 1.0 / (k + rank)
            if chunk.chunk_id not in chunk_map:
                chunk_map[chunk.chunk_id] = chunk

        # Sort by RRF score and attach it
        sorted_ids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)
        result = []
        for cid in sorted_ids:
            chunk = chunk_map[cid]
            chunk.rrf_score = scores[cid]
            result.append(chunk)
        return result

    def _apply_metadata_filters(
        self,
        chunks: list[ScoredChunk],
        filters: dict,
    ) -> list[ScoredChunk]:
        """Post-filter chunks by metadata (e.g., page_number range, section_title)."""
        filtered = []
        for chunk in chunks:
            match = True
            for key, value in filters.items():
                if chunk.metadata.get(key) != value:
                    match = False
                    break
            if match:
                filtered.append(chunk)
        return filtered

    async def _rerank(
        self,
        query: str,
        chunks: list[ScoredChunk],
        top_k: int,
    ) -> list[ScoredChunk]:
        """Rerank chunks (passthrough for now, Cohere in production)."""
        if settings.RERANKER_BACKEND == "passthrough":
            return chunks[:top_k]

        if settings.RERANKER_BACKEND == "cohere":
            return await self._cohere_rerank(query, chunks, top_k)

        return chunks[:top_k]

    async def _cohere_rerank(self, query, chunks, top_k):
        """Cohere reranking API integration."""
        import cohere
        co = cohere.AsyncClient(settings.COHERE_API_KEY)
        response = await co.rerank(
            query=query,
            documents=[c.content for c in chunks],
            top_n=top_k,
            model="rerank-english-v3.0",
        )
        reranked = []
        for result in response.results:
            chunk = chunks[result.index]
            chunk.rerank_score = result.relevance_score
            reranked.append(chunk)
        return reranked
