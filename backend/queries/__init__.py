"""
DocuMind Queries Package — Typed, composable SQLAlchemy query functions.

Architecture:
  queries/
    __init__.py       ← this file: shared base, filters, composables
    documents.py      ← document CRUD + chunk queries
    users.py          ← user/role lookups
    tenants.py        ← tenant CRUD + usage
    conversations.py  ← conversation + message queries
    analytics.py      ← aggregate / metrics queries
    auth.py           ← refresh token + login tracking
    audit.py          ← append-only audit log queries

Design:
  - Every function returns a SQLAlchemy Select/Insert/Update statement (no session).
  - The repository layer calls `session.execute(query)` and handles results.
  - This separation enables: reuse, testing, composability, and type-safety.
  - Filters are composable functions that mutate Select in place.
"""
from datetime import datetime, timezone
from typing import Any, Optional, TypeVar
from uuid import UUID

from sqlalchemy import Select, and_, func, select, update
from sqlalchemy.orm import DeclarativeBase


# ─── Shared filter composables ────────────────────────────────────────────────

def apply_soft_delete_filter(stmt: Select, model: Any) -> Select:
    """Exclude soft-deleted rows (deleted_at IS NULL)."""
    return stmt.where(model.deleted_at.is_(None))


def apply_tenant_filter(stmt: Select, model: Any, tenant_id: UUID) -> Select:
    """Filter by tenant_id."""
    return stmt.where(model.tenant_id == tenant_id)


def apply_pagination(stmt: Select, *, limit: int = 20, offset: int = 0) -> Select:
    """Apply LIMIT/OFFSET pagination."""
    return stmt.limit(limit).offset(offset)


async def count_from(session, subquery) -> int:
    """Execute a COUNT(*) over a subquery and return the scalar."""
    result = await session.scalar(
        select(func.count()).select_from(subquery)
    )
    return result or 0


# ─── Time helpers ─────────────────────────────────────────────────────────────

def utc_now() -> datetime:
    """Return timezone-aware UTC now."""
    return datetime.now(timezone.utc)
