"""Chat repository — conversations and messages data access."""
from __future__ import annotations  # `list()` method must not shadow list[...] hints

from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Conversation, Message


class ConversationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Conversation:
        conv = Conversation(**kwargs)
        self.db.add(conv)
        await self.db.flush()
        await self.db.refresh(conv)
        return conv

    async def get_by_id(self, conv_id: UUID, tenant_id: UUID) -> Optional[Conversation]:
        result = await self.db.execute(
            select(Conversation).where(and_(
                Conversation.id == conv_id,
                Conversation.tenant_id == tenant_id,
                Conversation.deleted_at.is_(None),
            ))
        )
        return result.scalar_one_or_none()

    async def list(self, tenant_id: UUID, user_id: UUID, limit: int = 20, offset: int = 0):
        base_q = select(Conversation).where(and_(
            Conversation.tenant_id == tenant_id,
            Conversation.user_id == user_id,
            Conversation.deleted_at.is_(None),
        ))
        count = await self.db.scalar(select(func.count()).select_from(base_q.subquery()))
        items_result = await self.db.execute(
            base_q.order_by(Conversation.last_message_at.desc().nullslast()).limit(limit).offset(offset)
        )
        return list(items_result.scalars().all()), count

    async def update_summary(self, conv_id: UUID, summary: str) -> None:
        await self.db.execute(
            update(Conversation).where(Conversation.id == conv_id).values(summary=summary)
        )

    async def bump_counters(
        self,
        conv_id: UUID,
        *,
        message_delta: int = 1,
        token_delta: int = 0,
    ) -> None:
        """Increment message/token counters and stamp last_message_at."""
        from datetime import UTC, datetime
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conv_id)
            .values(
                message_count=Conversation.message_count + message_delta,
                token_count=Conversation.token_count + token_delta,
                last_message_at=datetime.now(UTC),
            )
        )

    async def soft_delete(self, conv_id: UUID, tenant_id: UUID) -> bool:
        from datetime import UTC, datetime
        result = await self.db.execute(
            update(Conversation).where(and_(
                Conversation.id == conv_id,
                Conversation.tenant_id == tenant_id,
                Conversation.deleted_at.is_(None),
            )).values(deleted_at=datetime.now(UTC))
        )
        return result.rowcount > 0


class MessageRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> Message:
        msg = Message(**kwargs)
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def list(
        self,
        conversation_id: UUID,
        limit: int = 50,
        before_id: Optional[UUID] = None,
    ) -> list[Message]:
        q = select(Message).where(Message.conversation_id == conversation_id)
        if before_id:
            # Cursor-based pagination
            ref = await self.db.scalar(
                select(Message.created_at).where(Message.id == before_id)
            )
            if ref:
                q = q.where(Message.created_at < ref)
        result = await self.db.execute(
            q.order_by(Message.created_at.asc()).limit(limit)
        )
        return list(result.scalars().all())

    async def mark_summarized(self, message_ids: list[UUID]) -> None:
        await self.db.execute(
            update(Message).where(Message.id.in_(message_ids)).values(is_summarized=True)
        )

    async def count_unsummarized(self, conversation_id: UUID) -> int:
        """Number of messages not yet folded into the running summary."""
        return await self.db.scalar(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.is_summarized.is_(False),
                )
            )
        ) or 0
