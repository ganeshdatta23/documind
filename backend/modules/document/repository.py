"""Document repository — data access for documents and chunks."""
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Document, DocumentChunk


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
        result = await self.db.execute(
            select(Document).where(and_(
                Document.id == document_id,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            ))
        )
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
        base_q = select(Document).where(and_(
            Document.tenant_id == tenant_id,
            Document.deleted_at.is_(None),
        ))
        if status:
            base_q = base_q.where(Document.status == status)
        if tags:
            from sqlalchemy.dialects.postgresql import ARRAY
            base_q = base_q.where(Document.tags.overlap(tags))
        if uploaded_by:
            base_q = base_q.where(Document.uploaded_by == uploaded_by)

        count_result = await self.db.execute(
            select(func.count()).select_from(base_q.subquery())
        )
        total = count_result.scalar_one()

        items_result = await self.db.execute(
            base_q.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        )
        return list(items_result.scalars().all()), total

    async def update_status(
        self,
        document_id: UUID,
        status: str,
        error_message: Optional[str] = None,
        **extra_fields,
    ) -> None:
        values = {"status": status}
        if error_message is not None:
            values["error_message"] = error_message
        values.update(extra_fields)
        await self.db.execute(
            update(Document).where(Document.id == document_id).values(**values)
        )

    async def soft_delete(self, document_id: UUID, tenant_id: UUID) -> bool:
        from datetime import UTC, datetime
        result = await self.db.execute(
            update(Document)
            .where(and_(
                Document.id == document_id,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            ))
            .values(deleted_at=datetime.now(UTC))
        )
        return result.rowcount > 0

    async def update(self, document_id: UUID, tenant_id: UUID, **kwargs) -> Optional[Document]:
        await self.db.execute(
            update(Document).where(and_(
                Document.id == document_id,
                Document.tenant_id == tenant_id,
            )).values(**kwargs)
        )
        return await self.get_by_id(document_id, tenant_id)

    async def create_chunks(self, chunks: list[dict]) -> list[DocumentChunk]:
        chunk_objects = [DocumentChunk(**c) for c in chunks]
        self.db.add_all(chunk_objects)
        await self.db.flush()
        return chunk_objects

    async def get_chunks(self, document_id: UUID, tenant_id: UUID) -> list[DocumentChunk]:
        result = await self.db.execute(
            select(DocumentChunk).where(and_(
                DocumentChunk.document_id == document_id,
                DocumentChunk.tenant_id == tenant_id,
            )).order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def get_total_storage_used(self, tenant_id: UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(Document.file_size_bytes), 0)).where(and_(
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            ))
        )
        return result.scalar_one()
