"""
User queries — typed SQLAlchemy statements for users and roles.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import Select, and_, delete, func, insert, select, update
from sqlalchemy.orm import selectinload

from models import Role, User, user_roles_table


# ─── Selects ──────────────────────────────────────────────────────────────────

def select_user(user_id: UUID, tenant_id: UUID) -> Select:
    """Single user by ID within tenant, with roles eagerly loaded."""
    return (
        select(User)
        .where(
            and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
            )
        )
        .options(selectinload(User.roles))
    )


def select_user_by_email(email: str, tenant_id: UUID) -> Select:
    """User by email within a specific tenant."""
    return select(User).where(
        and_(
            User.email == email.lower(),
            User.tenant_id == tenant_id,
            User.deleted_at.is_(None),
        )
    )


def select_user_by_email_global(email: str) -> Select:
    """User by email across all tenants (for login). Includes roles."""
    return (
        select(User)
        .where(and_(User.email == email.lower(), User.deleted_at.is_(None)))
        .options(selectinload(User.roles))
    )


def select_users(
    tenant_id: UUID,
    *,
    is_active: Optional[bool] = None,
) -> Select:
    """
    Filtered user list query for a tenant.
    Returns a Select that can be paginated/counted by the caller.
    """
    stmt = (
        select(User)
        .where(and_(User.tenant_id == tenant_id, User.deleted_at.is_(None)))
        .options(selectinload(User.roles))
    )
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    return stmt.order_by(User.created_at.desc())


def select_user_count(tenant_id: UUID) -> Select:
    """COUNT of active (non-deleted) users in tenant."""
    return select(func.count(User.id)).where(
        and_(User.tenant_id == tenant_id, User.deleted_at.is_(None))
    )


def select_roles_by_names(role_names: list[str]) -> Select:
    """Load Role objects by their name slugs."""
    return select(Role).where(Role.name.in_(role_names))


# ─── Mutations ────────────────────────────────────────────────────────────────

def update_user_fields(user_id: UUID, tenant_id: UUID, **kwargs):
    """Partial update of user fields."""
    return (
        update(User)
        .where(and_(User.id == user_id, User.tenant_id == tenant_id))
        .values(**kwargs)
    )


def soft_delete_user(user_id: UUID, tenant_id: UUID):
    """Soft-delete a user."""
    from queries import utc_now
    return (
        update(User)
        .where(
            and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
            )
        )
        .values(deleted_at=utc_now(), is_active=False)
    )


def delete_user_role_associations(user_id: UUID):
    """Remove all role associations for a user."""
    return delete(user_roles_table).where(user_roles_table.c.user_id == user_id)


def insert_user_role(user_id: UUID, role_id: UUID):
    """Add a single role association."""
    return insert(user_roles_table).values(user_id=user_id, role_id=role_id)


# ─── Login tracking ──────────────────────────────────────────────────────────

def update_login_success(user_id: UUID, ip_address: Optional[str]):
    """Record successful login: reset counters, update timestamp."""
    from queries import utc_now
    return (
        update(User)
        .where(User.id == user_id)
        .values(
            last_login_at=utc_now(),
            last_login_ip=ip_address,
            failed_login_count=0,
            locked_until=None,
        )
    )


def update_login_failure(user_id: UUID, failed_count: int, locked_until=None):
    """Record failed login attempt."""
    return (
        update(User)
        .where(User.id == user_id)
        .values(failed_login_count=failed_count, locked_until=locked_until)
    )
