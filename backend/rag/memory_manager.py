"""Conversation memory manager — loads history and manages summarization."""
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
        """Load the most recent messages (not summarized)."""
        result = await self.db.execute(
            select(Message)
            .where(and_(
                Message.conversation_id == conversation_id,
                Message.is_summarized == False,  # noqa: E712
            ))
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_summary(self, conversation_id: UUID) -> Optional[str]:
        """Get the conversation summary if it exists."""
        result = await self.db.execute(
            select(Conversation.summary).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()
