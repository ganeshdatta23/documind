"""Search router — hybrid search endpoint with SSE streaming results."""
import json
import time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from core.dependencies import CurrentToken, DbSession, RedisConn
from modules.search.schemas import SearchRequest, SearchResponse
from modules.search.service import SearchService

router = APIRouter()


def _svc(db: DbSession, redis: RedisConn) -> SearchService:
    return SearchService(db=db, redis=redis)


@router.post("/", response_model=SearchResponse, summary="Hybrid search across documents")
async def search(
    payload: SearchRequest,
    token: CurrentToken,
    db: DbSession,
    redis: RedisConn,
):
    """
    Perform hybrid BM25 + vector search with optional RRF fusion and reranking.
    Returns ranked chunks with scores.
    """
    svc = _svc(db, redis)
    return await svc.search(
        query=payload.query,
        tenant_id=token.tenant_id,
        document_ids=payload.document_ids,
        top_k=payload.top_k,
        search_mode=payload.search_mode,
        metadata_filters=payload.metadata_filters,
    )


@router.post("/stream", summary="Stream search results (SSE)")
async def search_stream(
    payload: SearchRequest,
    token: CurrentToken,
    db: DbSession,
    redis: RedisConn,
):
    """Stream search results chunk-by-chunk via Server-Sent Events."""
    svc = _svc(db, redis)

    async def event_stream():
        t_start = time.time()
        results = await svc.search(
            query=payload.query,
            tenant_id=token.tenant_id,
            document_ids=payload.document_ids,
            top_k=payload.top_k,
            search_mode=payload.search_mode,
        )
        latency = int((time.time() - t_start) * 1000)

        for chunk in results.results:
            yield f"event: result\ndata: {chunk.model_dump_json()}\n\n"

        summary = json.dumps({
            "total": results.total_results,
            "latency_ms": latency,
            "search_mode": results.search_mode,
        })
        yield f"event: done\ndata: {summary}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/suggest", summary="Query autocomplete suggestions")
async def suggest(
    q: str = Query(min_length=2, max_length=100),
    token: CurrentToken = Depends(),
    redis: RedisConn = Depends(),
):
    """Return cached search suggestions based on recent queries."""
    # Simple Redis-backed suggestions
    cache_key = f"suggest:{token.tenant_id}:{q.lower()}"
    cached = await redis.get(cache_key)
    if cached:
        return {"suggestions": json.loads(cached)}
    return {"suggestions": []}
