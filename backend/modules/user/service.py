"""User service — invite, manage, deactivate users within tenant context."""
from typing import Optional
from uuid import UUID

import structlog

from core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    QuotaExceededError,
)
from models import Role, User
from security import hash_password, verify_password
from modules.user.repository import UserRepository
from modules.user.schemas import (
    ChangePasswordRequest,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)

logger = structlog.get_logger(__name__)


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self.repo = repo

    async def create_user(
        self,
        tenant_id: UUID,
        payload: UserCreateRequest,
        created_by: UUID,
    ) -> UserResponse:
        existing = await self.repo.get_by_email(payload.email, tenant_id)
        if existing:
            raise ConflictError(f"User with email '{payload.email}' already exists")

        hashed = hash_password(payload.password)
        user = await self.repo.create(
            tenant_id=tenant_id,
            email=payload.email.lower(),
            hashed_password=hashed,
            full_name=payload.full_name,
        )
        # Assign initial roles
        if payload.roles:
            await self.repo.set_roles(user.id, tenant_id, payload.roles)
            await self.repo.refresh_roles(user)

        logger.info("user.created", user_id=str(user.id), tenant_id=str(tenant_id))
        return UserResponse.model_validate(user)

    async def get_user(self, user_id: UUID, tenant_id: UUID) -> UserResponse:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")
        return UserResponse.model_validate(user)

    async def list_users(
        self,
        tenant_id: UUID,
        *,
        is_active: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[UserResponse], int]:
        items, total = await self.repo.list(
            tenant_id, is_active=is_active, limit=limit, offset=offset
        )
        return [UserResponse.model_validate(u) for u in items], total

    async def update_user(
        self,
        user_id: UUID,
        tenant_id: UUID,
        payload: UserUpdateRequest,
    ) -> UserResponse:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")

        update_data = payload.model_dump(exclude_none=True)
        updated = await self.repo.update(user_id, tenant_id, **update_data)
        return UserResponse.model_validate(updated)

    async def change_password(
        self,
        user_id: UUID,
        tenant_id: UUID,
        payload: ChangePasswordRequest,
    ) -> None:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")
        if not user.hashed_password or not verify_password(
            payload.current_password, user.hashed_password
        ):
            raise PermissionDeniedError("Current password is incorrect")

        new_hash = hash_password(payload.new_password)
        await self.repo.update(user_id, tenant_id, hashed_password=new_hash)
        logger.info("user.password_changed", user_id=str(user_id))

    async def deactivate_user(self, user_id: UUID, tenant_id: UUID) -> None:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")
        await self.repo.update(user_id, tenant_id, is_active=False)
        logger.info("user.deactivated", user_id=str(user_id))

    async def activate_user(self, user_id: UUID, tenant_id: UUID) -> None:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")
        await self.repo.update(user_id, tenant_id, is_active=True)
        logger.info("user.activated", user_id=str(user_id))

    async def set_roles(
        self, user_id: UUID, tenant_id: UUID, role_names: list[str]
    ) -> UserResponse:
        user = await self.repo.get_by_id(user_id, tenant_id)
        if not user:
            raise NotFoundError("User not found")
        await self.repo.set_roles(user_id, tenant_id, role_names)
        user = await self.repo.get_by_id(user_id, tenant_id)
        return UserResponse.model_validate(user)
