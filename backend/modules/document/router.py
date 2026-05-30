"""
Document router — upload, list, get, update, delete, and status streaming.
"""
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from core.dependencies import CurrentToken, DbSession, Pagination, RedisConn, require_roles
from modules.document.repository import DocumentRepository
from modules.document.schemas import (
    DocumentListResponse,
    DocumentResponse,
    DocumentStatusResponse,
    DocumentUpdateRequest,
    DocumentUploadRequest,
)
from modules.document.service import DocumentService
from modules.ingestion.service import IngestionService

router = APIRouter()


def get_document_service(db: DbSession, redis: RedisConn) -> DocumentService:
    from integrations.storage.local import LocalStorageClient
    storage = LocalStorageClient()
    return DocumentService(
        repo=DocumentRepository(db),
        storage=storage,
        redis=redis,
    )


@router.post(
    "/",
    response_model=DocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a document",
)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: str = Form("[]"),  # JSON array string
    token: CurrentToken = Depends(),
    service: DocumentService = Depends(get_document_service),
):
    """
    Upload a document for processing.
    Supported formats: PDF, DOCX, TXT, HTML.
    Returns immediately with document ID; processing is async.
    """
    import json as _json
    tags_list = _json.loads(tags) if tags else []
    metadata = DocumentUploadRequest(
        title=title or file.filename,
        description=description,
        tags=tags_list,
    )
    doc = await service.upload(
        tenant_id=token.tenant_id,
        user_id=token.user_id,
        file=file,
        metadata=metadata,
    )
    return doc


@router.get("/", response_model=DocumentListResponse, summary="List documents")
async def list_documents(
    token: CurrentToken,
    pagination: Pagination,
    db: DbSession,
    status_filter: Optional[str] = Query(None, alias="status"),
    tags: Optional[list[str]] = Query(None),
    uploaded_by: Optional[UUID] = Query(None),
):
    """List documents for the current tenant with optional filters."""
    repo = DocumentRepository(db)
    items, total = await repo.list(
        tenant_id=token.tenant_id,
        status=status_filter,
        tags=tags,
        uploaded_by=uploaded_by,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return DocumentListResponse(
        items=[DocumentResponse.model_validate(d) for d in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{document_id}", response_model=DocumentResponse, summary="Get document")
async def get_document(
    document_id: UUID,
    token: CurrentToken,
    db: DbSession,
):
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id, token.tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse.model_validate(doc)


@router.patch("/{document_id}", response_model=DocumentResponse, summary="Update document")
async def update_document(
    document_id: UUID,
    payload: DocumentUpdateRequest,
    token: CurrentToken,
    db: DbSession,
):
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id, token.tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = payload.model_dump(exclude_none=True)
    updated = await repo.update(document_id, token.tenant_id, **update_data)
    return DocumentResponse.model_validate(updated)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete document")
async def delete_document(
    document_id: UUID,
    token: CurrentToken,
    db: DbSession,
):
    repo = DocumentRepository(db)
    deleted = await repo.soft_delete(document_id, token.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{document_id}/status", summary="Stream document processing status (SSE)")
async def stream_document_status(
    document_id: UUID,
    token: CurrentToken,
    db: DbSession,
    redis: RedisConn,
):
    """
    Server-Sent Events stream for real-time document processing status.
    Client connects and receives status updates until document is READY or FAILED.
    """
    repo = DocumentRepository(db)
    doc = await repo.get_by_id(document_id, token.tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    async def event_stream():
        import asyncio
        terminal_states = {"ready", "failed", "archived"}
        poll_interval = 2.0  # seconds

        while True:
            # Re-fetch from DB
            async with db.__class__(bind=db.get_bind()) as fresh_db:
                fresh_repo = DocumentRepository(fresh_db)
                current = await fresh_repo.get_by_id(document_id, token.tenant_id)

            if current:
                event_data = json.dumps({
                    "id": str(current.id),
                    "status": current.status,
                    "error_message": current.error_message,
                })
                yield f"event: status\ndata: {event_data}\n\n"

                if current.status in terminal_states:
                    yield f"event: done\ndata: {json.dumps({'status': current.status})}\n\n"
                    break

            await asyncio.sleep(poll_interval)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
