"""
Ingestion Worker — Celery task for document processing pipeline.
Steps: download → parse → chunk → store chunks → enqueue embedding
"""
from __future__ import annotations

import asyncio
import traceback
from uuid import UUID

import structlog
from celery import Task

from celery_app import celery_app

logger = structlog.get_logger(__name__)


class BaseDocuMindTask(Task):
    """Base task with async support and structured error handling."""
    abstract = True

    def run_async(self, coro):
        """Run async coroutine in Celery (sync) context."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)


@celery_app.task(
    bind=True,
    base=BaseDocuMindTask,
    name="workers.ingestion_worker.process_document",
    max_retries=3,
    default_retry_delay=60,
    queue="ingestion",
)
def process_document(self: Task, document_id: str, tenant_id: str) -> dict:
    """
    Main ingestion pipeline task.
    1. Download file from storage
    2. Parse to text
    3. Chunk text
    4. Store chunks in DB
    5. Update document status
    6. Enqueue embedding task
    """
    return self.run_async(_process_document_async(self, document_id, tenant_id))


async def run_ingestion_inline(document_id: str, tenant_id: str) -> None:
    """Run the full ingestion + embedding pipeline in-process (no Celery).

    Used on single-instance / free-tier deploys (CELERY_TASK_ALWAYS_EAGER) where
    there is no worker or broker. The upload endpoint schedules this as a
    background asyncio task, so the request returns immediately and the client
    polls document status. `task=None` selects the no-Celery code paths below.
    """
    try:
        await _process_document_async(None, document_id, tenant_id)
    except Exception:
        logger.error(
            "ingestion.inline_failed",
            document_id=document_id,
            traceback=traceback.format_exc(),
        )


async def _process_document_async(task, document_id: str, tenant_id: str) -> dict:
    """Async implementation of the ingestion pipeline."""
    from datetime import UTC, datetime

    from sqlalchemy import update

    from database import async_session_factory
    from integrations.storage.local import LocalStorageClient
    from models import IngestionJob
    from modules.document.repository import DocumentRepository

    doc_id = UUID(document_id)
    t_id = UUID(tenant_id)
    storage = LocalStorageClient()

    async with async_session_factory() as db:
        repo = DocumentRepository(db)
        doc = await repo.get_by_id(doc_id, t_id)
        if not doc:
            logger.error("ingestion.document_not_found", document_id=document_id)
            return {"status": "error", "reason": "document_not_found"}

        # Track this run as an IngestionJob row for observability/retries.
        job = IngestionJob(
            document_id=doc_id,
            tenant_id=t_id,
            job_type="full",
            status="running",
            celery_task_id=getattr(task.request, "id", None) if task is not None else None,
            attempt_count=(task.request.retries + 1) if task is not None else 1,
            started_at=datetime.now(UTC),
        )
        db.add(job)
        await db.flush()
        job_id = job.id

        async def _finish_job(status: str, error: str | None = None) -> None:
            await db.execute(
                update(IngestionJob)
                .where(IngestionJob.id == job_id)
                .values(
                    status=status,
                    error_message=error,
                    completed_at=datetime.now(UTC) if status in ("completed", "failed") else None,
                )
            )

        try:
            # Update status: parsing
            await repo.update_status(doc_id, "parsing")
            await db.commit()

            # Download file
            logger.info("ingestion.downloading", document_id=document_id)
            file_content = await storage.download(doc.storage_path)

            # Parse to text
            logger.info("ingestion.parsing", document_id=document_id, file_type=doc.file_type)
            text, page_count = await _parse_document(file_content, doc.file_type, doc.file_name)

            # Update page count
            await repo.update(doc_id, t_id, page_count=page_count)

            # Chunk text
            await repo.update_status(doc_id, "chunking")
            await db.commit()
            logger.info("ingestion.chunking", document_id=document_id)
            chunks = _chunk_text(text, doc_id, t_id)

            # Store chunks
            await repo.create_chunks(chunks)
            word_count = len(text.split())
            await repo.update(doc_id, t_id, word_count=word_count)
            await db.commit()

            # Update status: embedding (hand off to embedding worker)
            await repo.update_status(doc_id, "embedding")
            await db.commit()

            # Generate embeddings. Inline (no Celery) when running in-process;
            # otherwise hand off to the embedding worker via the queue.
            if task is None:
                from workers.embedding_worker import _generate_embeddings_async
                await _generate_embeddings_async(None, document_id, tenant_id)
            else:
                from workers.embedding_worker import generate_embeddings
                generate_embeddings.apply_async(
                    kwargs={"document_id": document_id, "tenant_id": tenant_id},
                    queue="embedding",
                )

            await _finish_job("completed")
            await db.commit()
            logger.info("ingestion.completed", document_id=document_id, chunks=len(chunks))
            return {"status": "chunked", "chunk_count": len(chunks)}

        except Exception as exc:
            logger.error(
                "ingestion.failed",
                document_id=document_id,
                error=str(exc),
                traceback=traceback.format_exc(),
            )
            await repo.update_status(doc_id, "failed", error_message=str(exc))
            await _finish_job("failed", error=str(exc)[:2000])
            await db.commit()

            if task is not None and task.request.retries < task.max_retries:
                raise task.retry(exc=exc, countdown=60 * (2 ** task.request.retries))
            # Inline mode, or retries exhausted — mark as failed permanently.
            return {"status": "dead_letter", "error": str(exc)}


async def _parse_document(content: bytes, file_type: str, file_name: str) -> tuple[str, int]:
    """Parse document to plain text based on file type."""
    if file_type == "pdf":
        return _parse_pdf(content)
    elif file_type == "docx":
        return _parse_docx(content)
    elif file_type in ("txt", "md"):
        return content.decode("utf-8", errors="replace"), 1
    elif file_type == "html":
        return _parse_html(content), 1
    else:
        return content.decode("utf-8", errors="replace"), 1


def _parse_pdf(content: bytes) -> tuple[str, int]:
    """Extract text from PDF using PyMuPDF."""
    import fitz  # PyMuPDF
    doc = fitz.open(stream=content, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    text = "\n\n".join(pages)
    return text, len(doc)


def _parse_docx(content: bytes) -> tuple[str, int]:
    """Extract text from DOCX."""
    import io
    from docx import Document as DocxDoc
    doc = DocxDoc(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n\n".join(paragraphs)
    return text, 1


def _parse_html(content: bytes) -> str:
    """Strip HTML tags and extract text."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(content, "html.parser")
    return soup.get_text(separator="\n", strip=True)


_TOKEN_ENCODER = None


def _count_tokens(text: str) -> int:
    """Accurate token count via tiktoken, with a word-count fallback."""
    global _TOKEN_ENCODER
    try:
        if _TOKEN_ENCODER is None:
            import tiktoken
            _TOKEN_ENCODER = tiktoken.get_encoding("cl100k_base")
        return len(_TOKEN_ENCODER.encode(text))
    except Exception:
        # Rough fallback: ~1.3 tokens per whitespace word.
        return int(len(text.split()) * 1.3)


def _chunk_text(text: str, document_id: UUID, tenant_id: UUID) -> list[dict]:
    """
    Chunk text using a recursive character splitter.
    Returns list of chunk dicts ready for DB insertion.
    """
    import hashlib
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,          # Characters (~512 tokens)
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    splits = splitter.split_text(text)

    chunks = []
    for i, chunk_text in enumerate(splits):
        content_hash = hashlib.sha256(chunk_text.encode()).hexdigest()
        chunks.append({
            "document_id": document_id,
            "tenant_id": tenant_id,
            "chunk_index": i,
            "content": chunk_text,
            "content_hash": content_hash,
            "token_count": _count_tokens(chunk_text),
        })
    return chunks
