"""
Audit logging helper.

Writes immutable audit rows for security/compliance-relevant actions. Designed
to never break the primary flow: failures here are logged, not raised. The row
is flushed on the request's session and committed with the rest of the unit of
work (or written standalone via `commit=True`).
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from modules.audit.repository import AuditRepository

logger = structlog.get_logger(__name__)


async def record_audit(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    action: str,
    resource_type: str,
    actor_id: Optional[UUID] = None,
    actor_type: str = "user",
    resource_id: Optional[UUID] = None,
    status: str = "success",
    metadata: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    commit: bool = False,
) -> None:
    """Record an audit entry. Best-effort — swallows and logs any failure."""
    ip = user_agent = request_id = None
    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        request_id = getattr(request.state, "request_id", None)

    try:
        repo = AuditRepository(db)
        await repo.create(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=user_agent,
            request_id=request_id,
            metadata=metadata or {},
            status=status,
        )
        if commit:
            await db.commit()
    except Exception as exc:
        logger.warning("audit.record_failed", action=action, error=str(exc))
