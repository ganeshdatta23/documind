"""API key service — issuance, listing, and revocation."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog

from core.exceptions import NotFoundError
from modules.apikey.repository import APIKeyRepository
from modules.apikey.schemas import (
    APIKeyCreatedResponse,
    APIKeyCreateRequest,
    APIKeyResponse,
)
from security import generate_api_key

logger = structlog.get_logger(__name__)


class APIKeyService:
    def __init__(self, repo: APIKeyRepository) -> None:
        self.repo = repo

    async def create(
        self, tenant_id: UUID, user_id: UUID, payload: APIKeyCreateRequest
    ) -> APIKeyCreatedResponse:
        full_key, key_prefix, key_hash = generate_api_key(is_live=True)
        expires_at = (
            datetime.now(UTC) + timedelta(days=payload.expires_in_days)
            if payload.expires_in_days
            else None
        )
        key = await self.repo.create(
            tenant_id=tenant_id,
            user_id=user_id,
            name=payload.name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=payload.scopes,
            expires_at=expires_at,
            is_active=True,
        )
        logger.info("apikey.created", key_id=str(key.id), tenant_id=str(tenant_id))
        # The plaintext key is shown only here, never persisted.
        return APIKeyCreatedResponse(
            **APIKeyResponse.model_validate(key).model_dump(),
            api_key=full_key,
        )

    async def list(self, tenant_id: UUID) -> tuple[list[APIKeyResponse], int]:
        items, total = await self.repo.list(tenant_id)
        return [APIKeyResponse.model_validate(k) for k in items], total

    async def revoke(self, key_id: UUID, tenant_id: UUID) -> None:
        if not await self.repo.revoke(key_id, tenant_id):
            raise NotFoundError("API key not found")
        logger.info("apikey.revoked", key_id=str(key_id), tenant_id=str(tenant_id))
