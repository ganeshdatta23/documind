"""
Document Service — Business logic for document upload, validation, and management.
"""
from __future__ import annotations

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
    StorageError,
    StorageQuotaExceededError,
)
from modules.document.repository import DocumentRepository
from modules.document.schemas import DocumentResponse, DocumentUploadRequest
from modules.tenant.service import TenantService

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
    def __init__(
        self,
        repo: DocumentRepository,
        storage,
        redis,
        tenant_service: TenantService | None = None,
    ) -> None:
        self.repo = repo
        self.storage = storage
        self.redis = redis
        self.tenant_service = tenant_service

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
        size = len(content)

        # 3. Enforce per-file and per-tenant quotas
        if size > settings.MAX_FILE_SIZE_BYTES:
            raise StorageQuotaExceededError(
                f"File exceeds maximum size of {settings.MAX_FILE_SIZE_BYTES // 1024 // 1024}MB"
            )
        if self.tenant_service is not None:
            await self.tenant_service.check_document_quota(tenant_id)
            await self.tenant_service.check_storage_quota(tenant_id, additional_bytes=size)

        # 4. Calculate checksum
        checksum = hashlib.sha256(content).hexdigest()

        # 5. Determine file type
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"
        file_type = MIME_TO_TYPE.get(file.content_type or "", ext)

        # 6. Upload to storage
        document_id = uuid4()
        storage_path = f"{tenant_id}/documents/{document_id}/{file.filename}"
        try:
            await self.storage.upload(
                path=storage_path,
                data=io.BytesIO(content),
                content_type=file.content_type or "application/octet-stream",
            )
        except Exception as exc:
            logger.error("document.storage_upload_failed", error=str(exc), file_name=file.filename)
            raise StorageError("Failed to store the uploaded file") from exc

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
            file_size_bytes=size,
            storage_path=storage_path,
            storage_bucket=settings.STORAGE_BUCKET,
            checksum_sha256=checksum,
            status="pending",
            tags=metadata.tags,
            custom_metadata=metadata.custom_metadata,
        )

        # 8. Enqueue ingestion job (mark failed + reclaim storage if we cannot)
        enqueued = await self._enqueue_ingestion(doc.id, tenant_id)
        if not enqueued:
            await self.repo.update_status(
                doc.id, "failed", error_message="Could not enqueue ingestion job"
            )
            doc.status = "failed"

        # 9. Emit event (best-effort)
        try:
            from integrations.events import Events, emit_event
            await emit_event(
                self.repo.db, tenant_id, Events.DOCUMENT_UPLOADED,
                {"document_id": str(doc.id), "title": doc.title, "file_size_bytes": size},
            )
        except Exception:
            pass

        logger.info(
            "document.uploaded",
            document_id=str(doc.id),
            tenant_id=str(tenant_id),
            file_name=file.filename,
            file_size=size,
            status=doc.status,
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

    async def _enqueue_ingestion(self, document_id: UUID, tenant_id: UUID) -> bool:
        """Push document ID to the Celery ingestion queue. Returns True on success."""
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
            return True
        except Exception as e:
            logger.error("ingestion.enqueue.failed", document_id=str(document_id), error=str(e))
            return False
