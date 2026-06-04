"""
Conversation summarization worker.

When a conversation grows beyond CONVERSATION_SUMMARY_THRESHOLD un-summarized
messages, the oldest messages are folded into a running summary so the RAG
prompt stays within a bounded context window. The most recent
CONVERSATION_SUMMARY_KEEP_RECENT messages are always preserved verbatim.
"""
from __future__ import annotations

from uuid import UUID

import structlog

from celery_app import celery_app
from config import settings
from workers._async import run_async

logger = structlog.get_logger(__name__)

SUMMARY_PROMPT = """You maintain a running summary of a conversation between a user \
and an AI document assistant. Update the summary so it captures the key facts, \
questions asked, decisions, and any document references. Keep it concise (max ~200 words) \
and write in the third person.

Existing summary (may be empty):
{existing}

New messages to fold into the summary:
{transcript}

Updated summary:"""


@celery_app.task(
    bind=True,
    name="workers.summary_worker.summarize_conversation",
    queue="summaries",
    max_retries=2,
    default_retry_delay=30,
)
def summarize_conversation(self, conversation_id: str) -> dict:
    """Roll older messages of a conversation into a running summary."""
    return run_async(_summarize_async(self, conversation_id))


async def _summarize_async(task, conversation_id: str) -> dict:
    from openai import AsyncOpenAI
    from sqlalchemy import select, update

    from database import async_session_factory
    from models import Conversation, Message

    conv_id = UUID(conversation_id)
    keep_recent = settings.CONVERSATION_SUMMARY_KEEP_RECENT
    threshold = settings.CONVERSATION_SUMMARY_THRESHOLD

    async with async_session_factory() as db:
        conv = await db.get(Conversation, conv_id)
        if not conv:
            return {"status": "skipped", "reason": "conversation_not_found"}

        messages = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == conv_id, Message.is_summarized.is_(False))
                .order_by(Message.created_at.asc())
            )
        ).scalars().all()

        if len(messages) <= threshold:
            return {"status": "skipped", "reason": "below_threshold", "count": len(messages)}

        to_summarize = messages[:-keep_recent] if keep_recent else messages
        if not to_summarize:
            return {"status": "skipped", "reason": "nothing_to_summarize"}

        transcript = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:1000]}"
            for m in to_summarize
        )

        try:
            llm = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            response = await llm.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                messages=[{
                    "role": "user",
                    "content": SUMMARY_PROMPT.format(
                        existing=conv.summary or "(none)", transcript=transcript
                    ),
                }],
                temperature=0.2,
                max_tokens=400,
            )
            new_summary = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.error("summary.llm_failed", conversation_id=conversation_id, error=str(exc))
            if task.request.retries < task.max_retries:
                raise task.retry(exc=exc, countdown=30 * (2 ** task.request.retries))
            return {"status": "error", "error": str(exc)}

        await db.execute(
            update(Conversation).where(Conversation.id == conv_id).values(summary=new_summary)
        )
        await db.execute(
            update(Message)
            .where(Message.id.in_([m.id for m in to_summarize]))
            .values(is_summarized=True)
        )
        await db.commit()

    logger.info(
        "summary.updated",
        conversation_id=conversation_id,
        summarized_messages=len(to_summarize),
    )
    return {"status": "ok", "summarized": len(to_summarize)}
