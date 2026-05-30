"""
Embedding Worker — Generate and store vector embeddings for document chunks.
"""
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
    """Generate OpenAI embeddings for all chunks of a document and store in pgvector."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_generate_embeddings_async(self, document_id, tenant_id))


async def _generate_embeddings_async(task, document_id: str, tenant_id: str) -> dict:
    from database import async_session_factory
    from modules.document.repository import DocumentRepository

    doc_id = UUID(document_id)
    t_id = UUID(tenant_id)

    async with async_session_factory() as db:
        repo = DocumentRepository(db)
        doc = await repo.get_by_id(doc_id, t_id)
        if not doc:
            return {"status": "error", "reason": "document_not_found"}

        try:
            # Load chunks
            chunks = await repo.get_chunks(doc_id, t_id)
            if not chunks:
                await repo.update_status(doc_id, "ready")
                await db.commit()
                return {"status": "ready", "chunk_count": 0}

            # Generate embeddings in batches
            texts = [c.content for c in chunks]
            embeddings = await _embed_batch(texts)

            # Store embeddings in pgvector
            from sqlalchemy import text
            for chunk, embedding in zip(chunks, embeddings):
                # Use raw SQL for pgvector upsert
                await db.execute(
                    text("""
                        INSERT INTO chunk_embeddings
                            (chunk_id, tenant_id, document_id, embedding, model_name)
                        VALUES
                            (:chunk_id, :tenant_id, :document_id, :embedding, :model_name)
                        ON CONFLICT (chunk_id) DO UPDATE
                            SET embedding = EXCLUDED.embedding,
                                updated_at = NOW()
                    """),
                    {
                        "chunk_id": str(chunk.id),
                        "tenant_id": str(t_id),
                        "document_id": str(doc_id),
                        "embedding": str(embedding),
                        "model_name": settings.OPENAI_EMBEDDING_MODEL,
                    }
                )

            # Mark document as ready
            await repo.update_status(doc_id, "ready")
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
            await repo.update_status(doc_id, "failed", error_message=f"Embedding failed: {exc}")
            await db.commit()

            if task.request.retries < task.max_retries:
                raise task.retry(exc=exc, countdown=30 * (2 ** task.request.retries))
            return {"status": "dead_letter", "error": str(exc)}


async def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings via OpenAI API in batches."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    all_embeddings = []
    batch_size = settings.EMBEDDING_BATCH_SIZE

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=batch,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings
