"""Document repository — thin session wrapper over queries.documents."""
# Lazy annotations: this class defines a `list()` method, which would otherwise
# shadow the builtin `list` for the `list[...]` return hints below it.
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Document, DocumentChunk
from queries import count_from
from queries.documents import (
    select_document,
    select_document_chunks,
    select_document_count,
    select_documents,
    select_total_storage,
    soft_delete_document,
    update_document_fields,
    update_document_status,
)


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.db.add(doc)
        await self.db.flush()
        await self.db.refresh(doc)
        return doc

    async def get_by_id(self, document_id: UUID, tenant_id: UUID) -> Optional[Document]:
        result = await self.db.execute(select_document(document_id, tenant_id))
        return result.scalar_one_or_none()

    async def list(
        self,
        tenant_id: UUID,
        *,
        status: Optional[str] = None,
        tags: Optional[list[str]] = None,
        uploaded_by: Optional[UUID] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Document], int]:
        base = select_documents(tenant_id, status=status, tags=tags, uploaded_by=uploaded_by)
        total = await count_from(self.db, base.subquery())
        result = await self.db.execute(base.limit(limit).offset(offset))
        return list(result.scalars().all()), total

    async def update_status(
        self,
        document_id: UUID,
        status: str,
        error_message: Optional[str] = None,
        **extra_fields,
    ) -> None:
        await self.db.execute(
            update_document_status(document_id, status, error_message=error_message, **extra_fields)
        )

    async def soft_delete(self, document_id: UUID, tenant_id: UUID) -> bool:
        result = await self.db.execute(soft_delete_document(document_id, tenant_id))
        return result.rowcount > 0

    async def update(self, document_id: UUID, tenant_id: UUID, **kwargs) -> Optional[Document]:
        await self.db.execute(update_document_fields(document_id, tenant_id, **kwargs))
        return await self.get_by_id(document_id, tenant_id)

    async def create_chunks(self, chunks: list[dict]) -> list[DocumentChunk]:
        chunk_objects = [DocumentChunk(**c) for c in chunks]
        self.db.add_all(chunk_objects)
        await self.db.flush()
        return chunk_objects

    async def get_chunks(self, document_id: UUID, tenant_id: UUID) -> list[DocumentChunk]:
        result = await self.db.execute(select_document_chunks(document_id, tenant_id))
        return list(result.scalars().all())

    async def get_total_storage_used(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select_total_storage(tenant_id)) or 0

    async def get_document_count(self, tenant_id: UUID, *, status: Optional[str] = None) -> int:
        return await self.db.scalar(select_document_count(tenant_id, status=status)) or 0
