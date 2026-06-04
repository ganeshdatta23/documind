"""Webhook service — manage outbound webhook subscriptions."""
from __future__ import annotations

from uuid import UUID

import structlog

from core.exceptions import NotFoundError
from modules.webhook.repository import WebhookRepository
from modules.webhook.schemas import (
    WebhookCreatedResponse,
    WebhookCreateRequest,
    WebhookResponse,
    WebhookUpdateRequest,
)
from security import generate_webhook_secret

logger = structlog.get_logger(__name__)


class WebhookService:
    def __init__(self, repo: WebhookRepository) -> None:
        self.repo = repo

    async def create(
        self, tenant_id: UUID, user_id: UUID, payload: WebhookCreateRequest
    ) -> WebhookCreatedResponse:
        secret = generate_webhook_secret()
        wh = await self.repo.create(
            tenant_id=tenant_id,
            user_id=user_id,
            name=payload.name,
            url=str(payload.url),
            secret=secret,
            events=payload.events,
            is_active=True,
        )
        logger.info("webhook.created", webhook_id=str(wh.id), tenant_id=str(tenant_id))
        return WebhookCreatedResponse(
            **WebhookResponse.model_validate(wh).model_dump(),
            secret=secret,
        )

    async def list(self, tenant_id: UUID) -> tuple[list[WebhookResponse], int]:
        items, total = await self.repo.list(tenant_id)
        return [WebhookResponse.model_validate(w) for w in items], total

    async def update(
        self, webhook_id: UUID, tenant_id: UUID, payload: WebhookUpdateRequest
    ) -> WebhookResponse:
        if not await self.repo.get(webhook_id, tenant_id):
            raise NotFoundError("Webhook not found")
        data = payload.model_dump(exclude_none=True)
        if "url" in data:
            data["url"] = str(data["url"])
        updated = await self.repo.update(webhook_id, tenant_id, **data) if data else \
            await self.repo.get(webhook_id, tenant_id)
        return WebhookResponse.model_validate(updated)

    async def delete(self, webhook_id: UUID, tenant_id: UUID) -> None:
        if not await self.repo.soft_delete(webhook_id, tenant_id):
            raise NotFoundError("Webhook not found")
        logger.info("webhook.deleted", webhook_id=str(webhook_id), tenant_id=str(tenant_id))
