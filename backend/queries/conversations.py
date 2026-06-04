"""
Conversation queries — typed statements for conversations and messages.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import Select, and_, func, select, update

from models import Conversation, Message


# ─── Conversations ────────────────────────────────────────────────────────────

def select_conversation(conversation_id: UUID, tenant_id: UUID) -> Select:
    """Single conversation by ID within tenant."""
    return select(Conversation).where(
        and_(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
            Conversation.deleted_at.is_(None),
        )
    )


def select_conversations(
    tenant_id: UUID,
    *,
    user_id: Optional[UUID] = None,
) -> Select:
    """Filtered conversation list. Caller handles pagination."""
    stmt = select(Conversation).where(
        and_(
            Conversation.tenant_id == tenant_id,
            Conversation.deleted_at.is_(None),
        )
    )
    if user_id:
        stmt = stmt.where(Conversation.user_id == user_id)
    return stmt.order_by(Conversation.last_message_at.desc().nullslast())


def soft_delete_conversation(conversation_id: UUID, tenant_id: UUID):
    """Soft-delete a conversation."""
    from queries import utc_now
    return (
        update(Conversation)
        .where(
            and_(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
                Conversation.deleted_at.is_(None),
            )
        )
        .values(deleted_at=utc_now())
    )


def update_conversation_counters(
    conversation_id: UUID,
    *,
    message_count_delta: int = 1,
    token_count_delta: int = 0,
):
    """Increment message/token counters and update last_message_at."""
    from queries import utc_now
    return (
        update(Conversation)
        .where(Conversation.id == conversation_id)
        .values(
            message_count=Conversation.message_count + message_count_delta,
            token_count=Conversation.token_count + token_count_delta,
            last_message_at=utc_now(),
        )
    )


# ─── Messages ─────────────────────────────────────────────────────────────────

def select_messages(
    conversation_id: UUID,
    *,
    limit: int = 100,
    before_id: Optional[UUID] = None,
) -> Select:
    """Messages in a conversation, ordered newest-first."""
    stmt = select(Message).where(
        Message.conversation_id == conversation_id
    )
    if before_id:
        stmt = stmt.where(Message.id < before_id)
    return stmt.order_by(Message.created_at.asc()).limit(limit)
