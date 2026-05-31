"""
Document queries — typed SQLAlchemy statements for documents and chunks.

All functions return Select/Update/Insert — never execute.
The repository (or service) calls session.execute(query).
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import Select, and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Document, DocumentChunk


# ─── Selects ──────────────────────────────────────────────────────────────────

def select_document(document_id: UUID, tenant_id: UUID) -> Select:
    """Single document by ID within tenant, excluding soft-deleted."""
    return select(Document).where(
        and_(
            Document.id == document_id,
            Document.tenant_id == tenant_id,
            Document.deleted_at.is_(None),
        )
    )


def select_documents(
    tenant_id: UUID,
    *,
    status: Optional[str] = None,
    tags: Optional[list[str]] = None,
    uploaded_by: Optional[UUID] = None,
) -> Select:
    """
    Filtered document list query.
    Returns a Select that can be paginated/counted by the caller.
    """
    stmt = select(Document).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )
    if status:
        stmt = stmt.where(Document.status == status)
    if tags:
        stmt = stmt.where(Document.tags.overlap(tags))
    if uploaded_by:
        stmt = stmt.where(Document.uploaded_by == uploaded_by)
    return stmt.order_by(Document.created_at.desc())


def select_document_chunks(document_id: UUID, tenant_id: UUID) -> Select:
    """All chunks for a document, ordered by chunk_index."""
    return (
        select(DocumentChunk)
        .where(
            and_(
                DocumentChunk.document_id == document_id,
                DocumentChunk.tenant_id == tenant_id,
            )
        )
        .order_by(DocumentChunk.chunk_index)
    )


def select_total_storage(tenant_id: UUID) -> Select:
    """SUM of file_size_bytes for all active documents in tenant."""
    return select(
        func.coalesce(func.sum(Document.file_size_bytes), 0)
    ).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )


def select_document_count(
    tenant_id: UUID,
    *,
    status: Optional[str] = None,
) -> Select:
    """COUNT of documents in tenant, optionally filtered by status."""
    stmt = select(func.count(Document.id)).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )
    if status:
        stmt = stmt.where(Document.status == status)
    return stmt


# ─── Mutations ────────────────────────────────────────────────────────────────

def update_document_status(
    document_id: UUID,
    status: str,
    *,
    error_message: Optional[str] = None,
    **extra_fields,
):
    """Update document status (and optional error message)."""
    values = {"status": status, **extra_fields}
    if error_message is not None:
        values["error_message"] = error_message
    return update(Document).where(Document.id == document_id).values(**values)


def soft_delete_document(document_id: UUID, tenant_id: UUID):
    """Soft-delete a document."""
    from queries import utc_now
    return (
        update(Document)
        .where(
            and_(
                Document.id == document_id,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            )
        )
        .values(deleted_at=utc_now())
    )


def update_document_fields(document_id: UUID, tenant_id: UUID, **kwargs):
    """Partial update of document fields."""
    return (
        update(Document)
        .where(and_(Document.id == document_id, Document.tenant_id == tenant_id))
        .values(**kwargs)
    )
