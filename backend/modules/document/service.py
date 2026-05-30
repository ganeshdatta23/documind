"""
Document Service — Business logic for document upload, validation, and management.
"""
import hashlib
import io
from typing import Optional
from uuid import UUID, uuid4

import structlog
from fastapi import UploadFile

from config import settings
from core.exceptions import (
    InvalidFileContentError,
    InvalidFileTypeError,
    StorageQuotaExceededError,
)
from modules.document.repository import DocumentRepository
from modules.document.schemas import DocumentResponse, DocumentUploadRequest

logger = structlog.get_logger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".html", ".md"}
MIME_TO_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/html": "html",
    "text/markdown": "md",
}


class DocumentService:
    def __init__(self, repo: DocumentRepository, storage, redis) -> None:
        self.repo = repo
        self.storage = storage
        self.redis = redis

    async def upload(
        self,
        tenant_id: UUID,
        user_id: UUID,
        file: UploadFile,
        metadata: DocumentUploadRequest,
    ) -> DocumentResponse:
        """
        Validate, store, and enqueue a document for processing.
        """
        # 1. Validate file type
        await self._validate_file(file)

        # 2. Read file content
        content = await file.read()
        await file.seek(0)

        # 3. Check storage quota
        current_usage = await self.repo.get_total_storage_used(tenant_id)
        # Tenant quota check would go here (load from tenant settings)
        # For now use global max
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            raise StorageQuotaExceededError(f"File exceeds maximum size of {settings.MAX_FILE_SIZE_BYTES // 1024 // 1024}MB")

        # 4. Calculate checksum
        checksum = hashlib.sha256(content).hexdigest()

        # 5. Determine file type
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"
        file_type = MIME_TO_TYPE.get(file.content_type or "", ext)

        # 6. Upload to storage
        document_id = uuid4()
        storage_path = f"{tenant_id}/documents/{document_id}/{file.filename}"
        await self.storage.upload(
            path=storage_path,
            data=io.BytesIO(content),
            content_type=file.content_type or "application/octet-stream",
        )

        # 7. Create document record
        doc = await self.repo.create(
            id=document_id,
            tenant_id=tenant_id,
            uploaded_by=user_id,
            title=metadata.title or file.filename,
            description=metadata.description,
            file_name=file.filename,
            file_type=file_type,
            mime_type=file.content_type or "application/octet-stream",
            file_size_bytes=len(content),
            storage_path=storage_path,
            storage_bucket=settings.STORAGE_BUCKET,
            checksum_sha256=checksum,
            status="pending",
            tags=metadata.tags,
            custom_metadata=metadata.custom_metadata,
        )

        # 8. Enqueue ingestion job
        await self._enqueue_ingestion(doc.id, tenant_id)

        logger.info(
            "document.uploaded",
            document_id=str(doc.id),
            tenant_id=str(tenant_id),
            file_name=file.filename,
            file_size=len(content),
        )

        return DocumentResponse.model_validate(doc)

    async def _validate_file(self, file: UploadFile) -> None:
        """Validate file type by MIME type and extension."""
        if file.content_type not in settings.ALLOWED_MIME_TYPES:
            raise InvalidFileTypeError(
                f"File type '{file.content_type}' is not supported. "
                f"Allowed: {', '.join(settings.ALLOWED_MIME_TYPES)}"
            )

        if file.filename:
            import pathlib
            ext = pathlib.Path(file.filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise InvalidFileTypeError(f"File extension '{ext}' is not allowed")

    async def _enqueue_ingestion(self, document_id: UUID, tenant_id: UUID) -> None:
        """Push document ID to Celery ingestion queue."""
        try:
            from workers.ingestion_worker import process_document
            result = process_document.apply_async(
                kwargs={
                    "document_id": str(document_id),
                    "tenant_id": str(tenant_id),
                },
                queue="ingestion",
            )
            logger.info("ingestion.enqueued", document_id=str(document_id), task_id=result.id)
        except Exception as e:
            logger.error("ingestion.enqueue.failed", document_id=str(document_id), error=str(e))
            # Don't raise — document is saved, can retry via admin
