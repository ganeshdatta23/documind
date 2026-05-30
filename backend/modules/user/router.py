"""User router — profile management, user CRUD (org admins), password change."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from core.dependencies import (
    CurrentToken,
    DbSession,
    Pagination,
    require_roles,
)
from modules.user.repository import UserRepository
from modules.user.schemas import (
    ChangePasswordRequest,
    UserCreateRequest,
    UserListResponse,
    UserResponse,
    UserRoleUpdateRequest,
    UserUpdateRequest,
)
from modules.user.service import UserService

router = APIRouter()


def _svc(db: DbSession) -> UserService:
    return UserService(UserRepository(db))


# ─── Current User ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse, summary="Get my profile")
async def get_me(token: CurrentToken, db: DbSession):
    svc = _svc(db)
    return await svc.get_user(token.user_id, token.tenant_id)


@router.patch("/me", response_model=UserResponse, summary="Update my profile")
async def update_me(
    payload: UserUpdateRequest,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    return await svc.update_user(token.user_id, token.tenant_id, payload)


@router.post(
    "/me/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change my password",
)
async def change_my_password(
    payload: ChangePasswordRequest,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    await svc.change_password(token.user_id, token.tenant_id, payload)


# ─── Tenant User Management (org_admin role required) ─────────────────────────

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite user to tenant",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def create_user(
    payload: UserCreateRequest,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    return await svc.create_user(token.tenant_id, payload, created_by=token.user_id)


@router.get(
    "/",
    response_model=UserListResponse,
    summary="List users in tenant",
    dependencies=[Depends(require_roles("org_admin", "member"))],
)
async def list_users(
    token: CurrentToken,
    db: DbSession,
    pagination: Pagination,
    is_active: Optional[bool] = Query(None),
):
    svc = _svc(db)
    items, total = await svc.list_users(
        token.tenant_id,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return UserListResponse(
        items=items, total=total, page=pagination.page, page_size=pagination.page_size
    )


@router.get("/{user_id}", response_model=UserResponse, summary="Get user")
async def get_user(
    user_id: UUID,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    return await svc.get_user(user_id, token.tenant_id)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    return await svc.update_user(user_id, token.tenant_id, payload)


@router.put(
    "/{user_id}/roles",
    response_model=UserResponse,
    summary="Set user roles",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def set_user_roles(
    user_id: UUID,
    payload: UserRoleUpdateRequest,
    token: CurrentToken,
    db: DbSession,
):
    svc = _svc(db)
    return await svc.set_roles(user_id, token.tenant_id, payload.roles)


@router.post(
    "/{user_id}/deactivate",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate user",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def deactivate_user(user_id: UUID, token: CurrentToken, db: DbSession):
    svc = _svc(db)
    await svc.deactivate_user(user_id, token.tenant_id)


@router.post(
    "/{user_id}/activate",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Activate user",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def activate_user(user_id: UUID, token: CurrentToken, db: DbSession):
    svc = _svc(db)
    await svc.activate_user(user_id, token.tenant_id)
