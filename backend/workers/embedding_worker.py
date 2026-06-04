"""
Embedding Worker — Generate and store vector embeddings for document chunks.
Uses ORM (ChunkEmbedding model) for upserts; pgvector column written via
the special cast required by sqlalchemy-pgvector.
"""
from __future__ import annotations

import asyncio
import traceback
from uuid import UUID

import structlog
from celery import Task

from celery_app import celery_app
from config import settings

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    name="workers.embedding_worker.generate_embeddings",
    max_retries=3,
    default_retry_delay=30,
    queue="embedding",
)
def generate_embeddings(self: Task, document_id: str, tenant_id: str) -> dict:
    """Generate OpenAI embeddings for all chunks and persist via ORM."""
    return asyncio.run(_generate_embeddings_async(self, document_id, tenant_id))


async def _generate_embeddings_async(task, document_id: str, tenant_id: str) -> dict:
    from database import async_session_factory
    from models import ChunkEmbedding
    from modules.document.repository import DocumentRepository
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    doc_id = UUID(document_id)
    t_id = UUID(tenant_id)

    async with async_session_factory() as db:
        repo = DocumentRepository(db)

        doc = await repo.get_by_id(doc_id, t_id)
        if not doc:
            return {"status": "error", "reason": "document_not_found"}

        try:
            await repo.update_status(doc_id, "embedding")
            await db.commit()

            # Load chunks via ORM
            chunks = await repo.get_chunks(doc_id, t_id)
            if not chunks:
                await repo.update_status(doc_id, "ready")
                await db.commit()
                return {"status": "ready", "chunk_count": 0}

            # Generate embeddings via OpenAI
            texts = [c.content for c in chunks]
            embeddings = await _embed_batch(texts)

            # Guard against a partial/misaligned response before persisting —
            # a mismatch would silently pair chunks with the wrong vectors.
            if len(embeddings) != len(chunks):
                raise ValueError(
                    f"Embedding count mismatch: got {len(embeddings)} for {len(chunks)} chunks"
                )

            # Upsert ChunkEmbedding rows via ORM insert-on-conflict
            # pgvector stores the list[float] as a vector — cast required
            for chunk, vector in zip(chunks, embeddings):
                stmt = (
                    pg_insert(ChunkEmbedding)
                    .values(
                        chunk_id=chunk.id,
                        tenant_id=t_id,
                        document_id=doc_id,
                        model_name=settings.OPENAI_EMBEDDING_MODEL,
                    )
                    .on_conflict_do_update(
                        index_elements=["chunk_id"],
                        set_={"model_name": settings.OPENAI_EMBEDDING_MODEL},
                    )
                )
                result = await db.execute(stmt)
                embedding_id = result.inserted_primary_key[0]

                # pgvector column must be set via raw SQL cast since SQLAlchemy
                # doesn't natively know the vector type — this is the ORM-sanctioned
                # approach for pgvector until sqlalchemy-pgvector is stabilised.
                from sqlalchemy import text, update
                await db.execute(
                    text(
                        "UPDATE chunk_embeddings "
                        "SET embedding = CAST(:vec AS vector) "
                        "WHERE chunk_id = :cid"
                    ),
                    {"vec": str(vector), "cid": str(chunk.id)},
                )

            await repo.update_status(doc_id, "ready")
            await db.commit()

            # Notify subscribers that the document is now queryable.
            from integrations.events import Events, emit_event
            await emit_event(
                db, t_id, Events.DOCUMENT_READY,
                {"document_id": document_id, "chunk_count": len(chunks), "title": doc.title},
            )
            await db.commit()

            logger.info(
                "embedding.completed",
                document_id=document_id,
                chunk_count=len(chunks),
            )
            return {"status": "ready", "chunk_count": len(chunks)}

        except Exception as exc:
            logger.error(
                "embedding.failed",
                document_id=document_id,
                error=str(exc),
                traceback=traceback.format_exc(),
            )
            await repo.update_status(
                doc_id, "failed", error_message=f"Embedding failed: {exc}"
            )
            await db.commit()

            if task.request.retries < task.max_retries:
                raise task.retry(exc=exc, countdown=30 * (2 ** task.request.retries))

            from integrations.events import Events, emit_event
            await emit_event(db, t_id, Events.DOCUMENT_FAILED,
                             {"document_id": document_id, "stage": "embedding", "error": str(exc)})
            await db.commit()
            return {"status": "dead_letter", "error": str(exc)}


async def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Call OpenAI embeddings API in configurable batch sizes."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), settings.EMBEDDING_BATCH_SIZE):
        batch = texts[i : i + settings.EMBEDDING_BATCH_SIZE]
        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=batch,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        all_embeddings.extend(item.embedding for item in response.data)

    return all_embeddings
