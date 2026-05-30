"""
RAG Engine — Main orchestrator for retrieval-augmented generation.
Coordinates: query rewriting → hybrid retrieval → reranking → prompt → streaming LLM → citations
"""
from dataclasses import dataclass, field
from typing import AsyncGenerator, Optional
from uuid import UUID

import structlog
from openai import AsyncOpenAI

from config import settings
from modules.chat.repository import ConversationRepository, MessageRepository

from .citation_engine import Citation, CitationEngine
from .memory_manager import ConversationMemoryManager
from .prompt_builder import PromptBuilder
from .query_rewriter import QueryRewriter
from .retriever import HybridRetriever, ScoredChunk

logger = structlog.get_logger(__name__)


@dataclass
class RAGResult:
    answer: str
    citations: list[Citation]
    chunks_used: list[ScoredChunk]
    retrieval_latency_ms: int
    total_tokens: Optional[int] = None
    model_name: Optional[str] = None


class RAGEngine:
    """
    Main RAG pipeline orchestrator.
    Used by the chat service to process user queries with document context.
    """

    def __init__(
        self,
        retriever: HybridRetriever,
        query_rewriter: QueryRewriter,
        prompt_builder: PromptBuilder,
        citation_engine: CitationEngine,
        memory_manager: ConversationMemoryManager,
    ) -> None:
        self.retriever = retriever
        self.query_rewriter = query_rewriter
        self.prompt_builder = prompt_builder
        self.citation_engine = citation_engine
        self.memory_manager = memory_manager
        self.llm = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def stream_answer(
        self,
        query: str,
        tenant_id: UUID,
        conversation_id: UUID,
        document_ids: Optional[list[UUID]] = None,
        metadata_filters: Optional[dict] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream a RAG answer for the given query.
        Yields dicts with 'type' key: 'status', 'token', 'done'.
        """
        import time

        yield {"type": "status", "stage": "retrieving"}

        # 1. Load conversation memory
        messages = await self.memory_manager.get_recent_messages(conversation_id)
        summary = await self.memory_manager.get_summary(conversation_id)

        # 2. Rewrite query using conversation history
        standalone_query = await self.query_rewriter.rewrite(query, messages)
        logger.info(
            "rag.query_rewritten",
            original=query[:100],
            rewritten=standalone_query[:100],
            conversation_id=str(conversation_id),
        )

        # 3. Hybrid retrieval
        t_start = time.time()
        chunks = await self.retriever.retrieve(
            query=standalone_query,
            tenant_id=tenant_id,
            document_ids=document_ids,
            metadata_filters=metadata_filters,
            top_k=settings.RERANK_TOP_K,
        )
        retrieval_latency = int((time.time() - t_start) * 1000)
        logger.info(
            "rag.retrieved",
            chunk_count=len(chunks),
            latency_ms=retrieval_latency,
            conversation_id=str(conversation_id),
        )

        if not chunks:
            yield {"type": "status", "stage": "no_context"}
            yield {
                "type": "done",
                "answer": "I don't have enough information in the available documents to answer this question.",
                "citations": [],
                "retrieval_latency_ms": retrieval_latency,
            }
            return

        yield {"type": "status", "stage": "generating"}

        # 4. Build prompt
        prompt_messages = self.prompt_builder.build(
            query=query,
            chunks=chunks,
            conversation_history=messages,
            summary=summary,
        )

        # 5. Stream LLM response
        full_response = ""
        total_tokens = 0

        async with self.llm.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=prompt_messages,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LLM_MAX_TOKENS,
            stream=True,
        ) as stream:
            async for chunk_obj in stream:
                delta = chunk_obj.choices[0].delta
                if delta.content:
                    full_response += delta.content
                    yield {"type": "token", "token": delta.content}

        # 6. Extract citations
        cleaned_answer, citations = self.citation_engine.extract_citations(
            answer=full_response,
            chunks=chunks,
        )

        logger.info(
            "rag.completed",
            citation_count=len(citations),
            response_length=len(full_response),
            conversation_id=str(conversation_id),
        )

        yield {
            "type": "done",
            "answer": cleaned_answer,
            "citations": [c.__dict__ for c in citations],
            "retrieval_latency_ms": retrieval_latency,
            "model_name": settings.OPENAI_CHAT_MODEL,
        }
