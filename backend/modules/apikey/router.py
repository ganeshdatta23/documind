"""API key router — issue, list, and revoke programmatic access keys."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Request, status

from core.dependencies import CurrentToken, DbSession
from modules.apikey.repository import APIKeyRepository
from modules.apikey.schemas import (
    APIKeyCreatedResponse,
    APIKeyCreateRequest,
    APIKeyListResponse,
)
from modules.apikey.service import APIKeyService

router = APIRouter()


def _svc(db: DbSession) -> APIKeyService:
    return APIKeyService(APIKeyRepository(db))


@router.post(
    "/",
    response_model=APIKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create API key (secret shown once)",
)
async def create_api_key(
    payload: APIKeyCreateRequest,
    request: Request,
    token: CurrentToken,
    db: DbSession,
):
    key = await _svc(db).create(token.tenant_id, token.user_id, payload)

    from core.audit import record_audit
    await record_audit(
        db, tenant_id=token.tenant_id, actor_id=token.user_id,
        action="apikey.create", resource_type="api_key", resource_id=key.id,
        request=request, metadata={"name": key.name, "scopes": key.scopes},
    )
    return key


@router.get("/", response_model=APIKeyListResponse, summary="List API keys")
async def list_api_keys(token: CurrentToken, db: DbSession):
    items, total = await _svc(db).list(token.tenant_id)
    return APIKeyListResponse(items=items, total=total)


@router.delete(
    "/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke API key",
)
async def revoke_api_key(
    key_id: UUID,
    request: Request,
    token: CurrentToken,
    db: DbSession,
):
    await _svc(db).revoke(key_id, token.tenant_id)

    from core.audit import record_audit
    await record_audit(
        db, tenant_id=token.tenant_id, actor_id=token.user_id,
        action="apikey.revoke", resource_type="api_key", resource_id=key_id,
        request=request,
    )
