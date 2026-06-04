"""
Tenant queries — typed SQLAlchemy statements for tenant management.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import Select, and_, func, select, update

from models import Document, Tenant, User


# ─── Selects ──────────────────────────────────────────────────────────────────

def select_tenant(tenant_id: UUID) -> Select:
    """Single tenant by ID, excluding soft-deleted."""
    return select(Tenant).where(
        and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
    )


def select_tenant_by_slug(slug: str) -> Select:
    """Tenant by unique slug, excluding soft-deleted."""
    return select(Tenant).where(
        and_(Tenant.slug == slug, Tenant.deleted_at.is_(None))
    )


def select_tenants(
    *,
    status: Optional[str] = None,
    plan: Optional[str] = None,
) -> Select:
    """Filtered tenant list query."""
    stmt = select(Tenant).where(Tenant.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Tenant.status == status)
    if plan:
        stmt = stmt.where(Tenant.plan == plan)
    return stmt.order_by(Tenant.created_at.desc())


# ─── Usage aggregates ─────────────────────────────────────────────────────────

def select_tenant_user_count(tenant_id: UUID) -> Select:
    """COUNT of active users in tenant."""
    return select(func.count(User.id)).where(
        and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
    )


def select_tenant_document_count(tenant_id: UUID) -> Select:
    """COUNT of active documents in tenant."""
    return select(func.count(Document.id)).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )


def select_tenant_storage_used(tenant_id: UUID) -> Select:
    """SUM of file_size_bytes for active documents."""
    return select(
        func.coalesce(func.sum(Document.file_size_bytes), 0)
    ).where(
        and_(Document.tenant_id == tenant_id, Document.deleted_at.is_(None))
    )


# ─── Mutations ────────────────────────────────────────────────────────────────

def update_tenant_fields(tenant_id: UUID, **kwargs):
    """Partial update of tenant fields."""
    return update(Tenant).where(Tenant.id == tenant_id).values(**kwargs)


def soft_delete_tenant(tenant_id: UUID):
    """Soft-delete a tenant."""
    from queries import utc_now
    return (
        update(Tenant)
        .where(and_(Tenant.id == tenant_id, Tenant.deleted_at.is_(None)))
        .values(deleted_at=utc_now(), status="deleted")
    )
