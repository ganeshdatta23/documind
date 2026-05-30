"""Audit router — query audit logs (org_admin+ access)."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.dependencies import CurrentToken, DbSession, Pagination, require_roles
from modules.audit.repository import AuditRepository
from modules.audit.schemas import AuditLogListResponse, AuditLogResponse

router = APIRouter()


@router.get(
    "/",
    response_model=AuditLogListResponse,
    summary="Query audit logs",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def list_audit_logs(
    token: CurrentToken,
    db: DbSession,
    pagination: Pagination,
    actor_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    since: Optional[datetime] = Query(None),
    until: Optional[datetime] = Query(None),
):
    """Return filtered audit log entries for the current tenant."""
    repo = AuditRepository(db)
    items, total = await repo.list(
        tenant_id=token.tenant_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        since=since,
        until=until,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(l) for l in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
