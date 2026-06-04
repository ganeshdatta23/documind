"""Tenant router — CRUD + usage (superadmin-only for list/create, tenant admins for own tenant)."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.dependencies import CurrentToken, DbSession, Pagination, SuperAdmin
from modules.tenant.repository import TenantRepository
from modules.tenant.schemas import (
    TenantCreateRequest,
    TenantListResponse,
    TenantResponse,
    TenantUpdateRequest,
    TenantUsageResponse,
)
from modules.tenant.service import TenantService

router = APIRouter()


def _get_service(db: DbSession) -> TenantService:
    return TenantService(TenantRepository(db))


@router.post(
    "/",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create tenant (superadmin)",
)
async def create_tenant(
    payload: TenantCreateRequest,
    _: SuperAdmin,
    service: TenantService = Depends(_get_service),
):
    return await service.create_tenant(payload)


@router.get("/", response_model=TenantListResponse, summary="List tenants (superadmin)")
async def list_tenants(
    _: SuperAdmin,
    pagination: Pagination,
    service: TenantService = Depends(_get_service),
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = Query(None),
):
    items, total = await service.list_tenants(
        status=status_filter, plan=plan,
        limit=pagination.limit, offset=pagination.offset,
    )
    return TenantListResponse(
        items=items, total=total, page=pagination.page, page_size=pagination.page_size
    )


@router.get("/me", response_model=TenantResponse, summary="Get current tenant")
async def get_current_tenant(
    token: CurrentToken,
    service: TenantService = Depends(_get_service),
):
    return await service.get_tenant(token.tenant_id)


@router.get("/me/usage", response_model=TenantUsageResponse, summary="Tenant usage")
async def get_current_tenant_usage(
    token: CurrentToken,
    service: TenantService = Depends(_get_service),
):
    return await service.get_usage(token.tenant_id)


@router.get("/{tenant_id}", response_model=TenantResponse, summary="Get tenant (superadmin)")
async def get_tenant(
    tenant_id: UUID,
    _: SuperAdmin,
    service: TenantService = Depends(_get_service),
):
    return await service.get_tenant(tenant_id)


@router.patch("/{tenant_id}", response_model=TenantResponse, summary="Update tenant (superadmin)")
async def update_tenant(
    tenant_id: UUID,
    payload: TenantUpdateRequest,
    _: SuperAdmin,
    service: TenantService = Depends(_get_service),
):
    return await service.update_tenant(tenant_id, payload)


@router.delete(
    "/{tenant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete tenant (superadmin)",
)
async def delete_tenant(
    tenant_id: UUID,
    _: SuperAdmin,
    service: TenantService = Depends(_get_service),
):
    await service.delete_tenant(tenant_id)
