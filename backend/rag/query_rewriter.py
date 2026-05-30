"""Query rewriter — condenses multi-turn conversation to a standalone question."""
from typing import Optional

from openai import AsyncOpenAI

from config import settings

CONDENSE_PROMPT = """Given the conversation history below and a follow-up question, \
rephrase the follow-up question to be a fully self-contained standalone question. \
Preserve all important context from the conversation.

Conversation History:
{history}

Follow-up Question: {question}

Standalone Question:"""


class QueryRewriter:
    def __init__(self) -> None:
        self.llm = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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
            return response.choices[0].message.content.strip()
        except Exception:
            return query  # Fallback to original query on error
