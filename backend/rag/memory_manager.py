"""Conversation memory manager — loads history and manages summarization."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Conversation, Message


class ConversationMemoryManager:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_recent_messages(
        self, conversation_id: UUID, limit: int = 10
    ) -> list[Message]:
        """
        Load the most recent un-summarized messages, returned in chronological
        order. We fetch newest-first (so the limit keeps the *latest* turns) then
        reverse, since older turns are folded into the summary separately.
        """
        result = await self.db.execute(
            select(Message)
            .where(and_(
                Message.conversation_id == conversation_id,
                Message.is_summarized.is_(False),
            ))
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return list(reversed(result.scalars().all()))

    async def get_summary(self, conversation_id: UUID) -> Optional[str]:
        """Get the conversation summary if it exists."""
        result = await self.db.execute(
            select(Conversation.summary).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()
