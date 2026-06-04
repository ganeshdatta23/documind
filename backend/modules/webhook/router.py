"""Webhook router — manage outbound event subscriptions (org_admin)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from core.dependencies import CurrentToken, DbSession, require_roles
from modules.webhook.repository import WebhookRepository
from modules.webhook.schemas import (
    WebhookCreatedResponse,
    WebhookCreateRequest,
    WebhookListResponse,
    WebhookResponse,
    WebhookUpdateRequest,
)
from modules.webhook.service import WebhookService

router = APIRouter()


def _svc(db: DbSession) -> WebhookService:
    return WebhookService(WebhookRepository(db))


@router.post(
    "/",
    response_model=WebhookCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create webhook (secret shown once)",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def create_webhook(payload: WebhookCreateRequest, token: CurrentToken, db: DbSession):
    return await _svc(db).create(token.tenant_id, token.user_id, payload)


@router.get("/", response_model=WebhookListResponse, summary="List webhooks")
async def list_webhooks(token: CurrentToken, db: DbSession):
    items, total = await _svc(db).list(token.tenant_id)
    return WebhookListResponse(items=items, total=total)


@router.patch(
    "/{webhook_id}",
    response_model=WebhookResponse,
    summary="Update webhook",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def update_webhook(
    webhook_id: UUID, payload: WebhookUpdateRequest, token: CurrentToken, db: DbSession
):
    return await _svc(db).update(webhook_id, token.tenant_id, payload)


@router.delete(
    "/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete webhook",
    dependencies=[Depends(require_roles("org_admin"))],
)
async def delete_webhook(webhook_id: UUID, token: CurrentToken, db: DbSession):
    await _svc(db).delete(webhook_id, token.tenant_id)
