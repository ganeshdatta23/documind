"""Tenant service — business logic for tenant lifecycle, quotas, and provisioning."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog

from core.exceptions import ConflictError, NotFoundError, QuotaExceededError
from modules.tenant.repository import TenantRepository
from modules.tenant.schemas import (
    TenantCreateRequest,
    TenantResponse,
    TenantUpdateRequest,
    TenantUsageResponse,
)

logger = structlog.get_logger(__name__)


class TenantService:
    def __init__(self, repo: TenantRepository) -> None:
        self.repo = repo

    async def create_tenant(self, payload: TenantCreateRequest) -> TenantResponse:
        existing = await self.repo.get_by_slug(payload.slug)
        if existing:
            raise ConflictError(f"Tenant slug '{payload.slug}' is already in use")

        tenant = await self.repo.create(**payload.model_dump())
        logger.info("tenant.created", tenant_id=str(tenant.id), slug=payload.slug)
        return TenantResponse.model_validate(tenant)

    async def get_tenant(self, tenant_id: UUID) -> TenantResponse:
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found")
        return TenantResponse.model_validate(tenant)

    async def list_tenants(
        self,
        *,
        status: Optional[str] = None,
        plan: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[TenantResponse], int]:
        items, total = await self.repo.list(
            status=status, plan=plan, limit=limit, offset=offset
        )
        return [TenantResponse.model_validate(t) for t in items], total

    async def update_tenant(
        self, tenant_id: UUID, payload: TenantUpdateRequest
    ) -> TenantResponse:
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found")

        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            return TenantResponse.model_validate(tenant)

        updated = await self.repo.update(tenant_id, **update_data)
        logger.info("tenant.updated", tenant_id=str(tenant_id), fields=list(update_data.keys()))
        return TenantResponse.model_validate(updated)

    async def delete_tenant(self, tenant_id: UUID) -> None:
        deleted = await self.repo.soft_delete(tenant_id)
        if not deleted:
            raise NotFoundError("Tenant not found")
        logger.info("tenant.deleted", tenant_id=str(tenant_id))

    async def get_usage(self, tenant_id: UUID) -> TenantUsageResponse:
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found")

        storage_used = await self.repo.get_storage_used(tenant_id)
        doc_count = await self.repo.get_document_count(tenant_id)
        user_count = await self.repo.get_user_count(tenant_id)
        api_calls = await self.repo.get_api_calls_this_month(tenant_id)

        return TenantUsageResponse(
            tenant_id=tenant_id,
            storage_used_bytes=storage_used,
            storage_limit_bytes=tenant.max_storage_bytes,
            document_count=doc_count,
            document_limit=tenant.max_documents,
            user_count=user_count,
            user_limit=tenant.max_users,
            api_calls_this_month=api_calls,
            api_call_limit=tenant.max_api_calls_month,
        )

    async def check_document_quota(self, tenant_id: UUID) -> None:
        """Raises QuotaExceededError if tenant at document limit."""
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found")
        doc_count = await self.repo.get_document_count(tenant_id)
        if doc_count >= tenant.max_documents:
            raise QuotaExceededError(
                f"Document limit reached ({tenant.max_documents} documents)"
            )

    async def check_storage_quota(self, tenant_id: UUID, additional_bytes: int) -> None:
        """Raises QuotaExceededError if file would exceed storage limit."""
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found")
        current = await self.repo.get_storage_used(tenant_id)
        if current + additional_bytes > tenant.max_storage_bytes:
            raise QuotaExceededError(
                f"Storage limit reached ({tenant.max_storage_bytes // 1024 // 1024}MB)"
            )
