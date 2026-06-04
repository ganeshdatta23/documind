"""Ingestion router — inspect ingestion jobs and retry stuck/failed documents."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from core.dependencies import CurrentToken, DbSession, Pagination
from modules.document.repository import DocumentRepository
from modules.ingestion.repository import IngestionRepository
from modules.ingestion.schemas import IngestionJobListResponse, IngestionJobResponse

router = APIRouter()


@router.get("/jobs", response_model=IngestionJobListResponse, summary="List ingestion jobs")
async def list_jobs(
    token: CurrentToken,
    db: DbSession,
    pagination: Pagination,
    document_id: Optional[UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    repo = IngestionRepository(db)
    items, total = await repo.list(
        token.tenant_id,
        document_id=document_id,
        status=status_filter,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return IngestionJobListResponse(
        items=[IngestionJobResponse.model_validate(j) for j in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/jobs/{job_id}", response_model=IngestionJobResponse, summary="Get ingestion job")
async def get_job(job_id: UUID, token: CurrentToken, db: DbSession):
    job = await IngestionRepository(db).get(job_id, token.tenant_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return IngestionJobResponse.model_validate(job)


@router.post(
    "/documents/{document_id}/retry",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-run ingestion for a failed/stuck document",
)
async def retry_ingestion(document_id: UUID, token: CurrentToken, db: DbSession):
    doc_repo = DocumentRepository(db)
    doc = await doc_repo.get_by_id(document_id, token.tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await doc_repo.update_status(document_id, "pending", error_message=None)
    await db.commit()

    from workers.ingestion_worker import process_document
    result = process_document.apply_async(
        kwargs={"document_id": str(document_id), "tenant_id": str(token.tenant_id)},
        queue="ingestion",
    )
    return {"status": "queued", "document_id": str(document_id), "task_id": result.id}
