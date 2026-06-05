"""
Chat router — conversations CRUD and streaming message endpoint.
"""
from __future__ import annotations

import json
import time
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from config import settings
from core.dependencies import CurrentToken, DbSession, Pagination
from modules.chat.repository import ConversationRepository, MessageRepository
from modules.chat.schemas import (
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationResponse,
    MessageRequest,
    MessageResponse,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/", response_model=ConversationResponse, summary="Create conversation")
async def create_conversation(
    payload: ConversationCreateRequest,
    token: CurrentToken,
    db: DbSession,
):
    repo = ConversationRepository(db)
    conv = await repo.create(
        tenant_id=token.tenant_id,
        user_id=token.user_id,
        title=payload.title,
        document_ids=[str(d) for d in payload.document_ids],
        settings=payload.settings,
    )
    return ConversationResponse.model_validate(conv)


@router.get("/", response_model=ConversationListResponse, summary="List conversations")
async def list_conversations(token: CurrentToken, db: DbSession, pagination: Pagination):
    repo = ConversationRepository(db)
    items, total = await repo.list(
        token.tenant_id, token.user_id,
        limit=pagination.limit, offset=pagination.offset
    )
    return ConversationListResponse(
        items=[ConversationResponse.model_validate(c) for c in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{conv_id}", response_model=ConversationResponse)
async def get_conversation(conv_id: UUID, token: CurrentToken, db: DbSession):
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conv_id, token.tenant_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationResponse.model_validate(conv)


@router.delete("/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conv_id: UUID, token: CurrentToken, db: DbSession):
    repo = ConversationRepository(db)
    deleted = await repo.soft_delete(conv_id, token.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get("/{conv_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conv_id: UUID,
    token: CurrentToken,
    db: DbSession,
    limit: int = Query(default=50, le=100),
    before_id: UUID | None = Query(None),
):
    conv_repo = ConversationRepository(db)
    conv = await conv_repo.get_by_id(conv_id, token.tenant_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conv.user_id) != str(token.user_id) and not token.is_superadmin:
        raise HTTPException(status_code=403, detail="Access denied")

    msg_repo = MessageRepository(db)
    messages = await msg_repo.list(conv_id, limit=limit, before_id=before_id)
    return [MessageResponse.model_validate(m) for m in messages]


@router.post("/{conv_id}/messages", summary="Send message with streaming RAG response (SSE)")
async def send_message(
    conv_id: UUID,
    payload: MessageRequest,
    token: CurrentToken,
    db: DbSession,
):
    """
    Send a user message and stream back the AI response with citations.
    Returns: text/event-stream with events: status, token, done.
    """
    # Validate conversation belongs to user
    conv_repo = ConversationRepository(db)
    conv = await conv_repo.get_by_id(conv_id, token.tenant_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message + bump conversation counters
    msg_repo = MessageRepository(db)
    await msg_repo.create(
        conversation_id=conv_id,
        tenant_id=token.tenant_id,
        role="user",
        content=payload.content,
    )
    await conv_repo.bump_counters(conv_id, message_delta=1)
    await db.commit()

    async def event_stream():
        from integrations.ai.embedding_client import EmbeddingClient
        from rag.citation_engine import CitationEngine
        from rag.engine import RAGEngine
        from rag.memory_manager import ConversationMemoryManager
        from rag.prompt_builder import PromptBuilder
        from rag.query_rewriter import QueryRewriter
        from rag.retriever import HybridRetriever

        from redis_client import get_redis_pool
        embedding_client = EmbeddingClient(redis=await get_redis_pool())
        retriever = HybridRetriever(db=db, embedding_client=embedding_client)
        engine = RAGEngine(
            retriever=retriever,
            query_rewriter=QueryRewriter(),
            prompt_builder=PromptBuilder(),
            citation_engine=CitationEngine(),
            memory_manager=ConversationMemoryManager(db),
        )

        # conv.document_ids come back from asyncpg as UUID objects already;
        # str() first so UUID() accepts both asyncpg UUIDs and plain strings.
        doc_ids = [UUID(str(d)) for d in (conv.document_ids or [])] or None
        answer = ""
        citations = []
        total_tokens = prompt_tokens = completion_tokens = 0
        t_start = time.time()

        try:
            async for event in engine.stream_answer(
                query=payload.content,
                tenant_id=token.tenant_id,
                conversation_id=conv_id,
                document_ids=doc_ids,
                metadata_filters=payload.metadata_filters,
            ):
                if event["type"] == "token":
                    answer += event["token"]
                if event["type"] == "done":
                    citations = event.get("citations", [])
                    answer = event.get("answer", answer)
                    prompt_tokens = event.get("prompt_tokens", 0)
                    completion_tokens = event.get("completion_tokens", 0)
                    total_tokens = event.get("total_tokens", 0)

                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
        except Exception as exc:  # surface a clean SSE error frame, never a broken stream
            logger.exception("chat.stream_failed", conversation_id=str(conv_id))
            yield f"event: error\ndata: {json.dumps({'message': 'Generation failed. Please try again.'})}\n\n"
            answer = answer or "[generation interrupted]"

        # Persist assistant message + counters + summarization trigger
        latency_ms = int((time.time() - t_start) * 1000)
        await msg_repo.create(
            conversation_id=conv_id,
            tenant_id=token.tenant_id,
            role="assistant",
            content=answer,
            citations=citations,
            prompt_tokens=prompt_tokens or None,
            completion_tokens=completion_tokens or None,
            total_tokens=total_tokens or None,
            latency_ms=latency_ms,
            model_name=settings.OPENAI_CHAT_MODEL,
        )
        await conv_repo.bump_counters(conv_id, message_delta=1, token_delta=total_tokens)
        await db.commit()

        # Fold older turns into a running summary once the conversation grows.
        if await msg_repo.count_unsummarized(conv_id) > settings.CONVERSATION_SUMMARY_THRESHOLD:
            try:
                from workers.summary_worker import summarize_conversation
                summarize_conversation.apply_async(
                    kwargs={"conversation_id": str(conv_id)}, queue="summaries"
                )
            except Exception as exc:
                logger.warning("chat.summary_enqueue_failed", error=str(exc))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
