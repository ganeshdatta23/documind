"""
Analytics queries — aggregation and metrics statements.
Used by the analytics repository/service for dashboard and reporting.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import Select, and_, func, select

from models import Conversation, Document, Message, Tenant, User


# ─── Document aggregates ─────────────────────────────────────────────────────

def select_document_counts_by_status(tenant_id: UUID) -> Select:
    """Group-by status for document distribution chart."""
    return (
        select(Document.status, func.count(Document.id).label("cnt"))
        .where(
            and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
        )
        .group_by(Document.status)
    )


def select_daily_upload_counts(tenant_id: UUID, days: int = 30) -> Select:
    """Daily document upload counts for the last N days (activity chart)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # Build the date_trunc expression ONCE and reuse it across select/group_by/
    # order_by. Calling it three times emits three separate bind params, so
    # Postgres won't recognize them as the same expression and raises a GROUP BY
    # error ("column documents.created_at must appear in the GROUP BY clause").
    day = func.date_trunc("day", Document.created_at)
    return (
        select(day.label("day"), func.count(Document.id).label("cnt"))
        .where(
            and_(
                Document.tenant_id == tenant_id,
                Document.created_at >= since,
                Document.deleted_at.is_(None),
            )
        )
        .group_by(day)
        .order_by(day)
    )


# ─── User aggregates ─────────────────────────────────────────────────────────

def select_active_user_count(tenant_id: UUID) -> Select:
    """COUNT of non-deleted users in tenant."""
    return select(func.count(User.id)).where(
        and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
    )


# ─── Conversation aggregates ─────────────────────────────────────────────────

def select_conversation_count_since(tenant_id: UUID, since: datetime) -> Select:
    """COUNT of conversations created after a given datetime."""
    return select(func.count(Conversation.id)).where(
        and_(
            Conversation.tenant_id == tenant_id,
            Conversation.created_at >= since,
            Conversation.deleted_at.is_(None),
        )
    )


def select_message_count_since(
    tenant_id: UUID,
    since: datetime,
    *,
    role: Optional[str] = "user",
) -> Select:
    """COUNT of messages since a datetime, optionally filtered by role."""
    conditions = [
        Message.tenant_id == tenant_id,
        Message.created_at >= since,
    ]
    if role:
        conditions.append(Message.role == role)
    return select(func.count(Message.id)).where(and_(*conditions))


# ─── Performance ──────────────────────────────────────────────────────────────

def select_avg_response_latency(tenant_id: UUID) -> Select:
    """AVG response latency from assistant messages (in ms)."""
    return select(func.avg(Message.latency_ms)).where(
        and_(
            Message.tenant_id == tenant_id,
            Message.role == "assistant",
            Message.latency_ms.is_not(None),
        )
    )


# ─── Storage ──────────────────────────────────────────────────────────────────

def select_total_storage_bytes(tenant_id: UUID) -> Select:
    """SUM of file_size_bytes for tenant's active documents."""
    return select(
        func.coalesce(func.sum(Document.file_size_bytes), 0)
    ).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )


# ─── Platform-wide (superadmin) ──────────────────────────────────────────────

def select_platform_tenant_count() -> Select:
    """COUNT of all active tenants."""
    return select(func.count(Tenant.id)).where(Tenant.deleted_at.is_(None))


def select_platform_user_count() -> Select:
    """COUNT of all active users across all tenants."""
    return select(func.count(User.id)).where(User.deleted_at.is_(None))


def select_platform_document_count(*, status: Optional[str] = None) -> Select:
    """COUNT of all documents, optionally filtered by status."""
    stmt = select(func.count(Document.id)).where(Document.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Document.status == status)
    return stmt


def select_platform_total_storage() -> Select:
    """SUM of storage across all tenants."""
    return select(
        func.coalesce(func.sum(Document.file_size_bytes), 0)
    ).where(Document.deleted_at.is_(None))
