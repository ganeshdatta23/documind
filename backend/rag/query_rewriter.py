"""Query rewriter — condenses multi-turn conversation to a standalone question."""
from __future__ import annotations


import structlog
from openai import AsyncOpenAI

from config import settings

logger = structlog.get_logger(__name__)

CONDENSE_PROMPT = """Given the conversation history below and a follow-up question, \
rephrase the follow-up question to be a fully self-contained standalone question. \
Preserve all important context from the conversation.

Conversation History:
{history}

Follow-up Question: {question}

Standalone Question:"""


class QueryRewriter:
    def __init__(self) -> None:
        self.llm = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL
        )

    async def rewrite(self, query: str, messages: list) -> str:
        """Rewrite query using conversation history. Returns standalone question."""
        if not messages:
            return query  # First turn — no rewriting needed

        # Format last 6 messages (3 turns)
        history_lines = []
        for msg in messages[-6:]:
            role = "Human" if msg.role == "user" else "Assistant"
            history_lines.append(f"{role}: {msg.content[:500]}")

        history = "\n".join(history_lines)

        try:
            response = await self.llm.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                messages=[{
                    "role": "user",
                    "content": CONDENSE_PROMPT.format(history=history, question=query)
                }],
                temperature=0,
                max_tokens=256,
            )
            rewritten = (response.choices[0].message.content or "").strip()
            return rewritten or query
        except Exception as exc:
            logger.warning("rag.query_rewrite_failed", error=str(exc))
            return query  # Fallback to original query on error
