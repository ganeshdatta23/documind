"""
Audit queries — append-only audit log statements.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Select, select

from models import AuditLog


def select_audit_logs(
    tenant_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> Select:
    """Filtered audit log query. Caller handles pagination."""
    stmt = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
    if until:
        stmt = stmt.where(AuditLog.created_at <= until)
    return stmt.order_by(AuditLog.created_at.desc())
