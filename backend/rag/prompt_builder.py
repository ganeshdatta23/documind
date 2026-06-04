"""Prompt builder — constructs LLM messages from query, context chunks, and history."""
from __future__ import annotations

from typing import Optional

from rag.retriever import ScoredChunk

SYSTEM_PROMPT = """You are DocuMind, an intelligent document assistant. \
Answer questions accurately and concisely using ONLY the provided document context.

Rules:
1. Use ONLY information from the provided context below
2. Always cite sources using [1], [2], etc. format
3. If the answer is not in the context, say: "I don't have enough information in the available documents to answer this."
4. Be professional and concise
5. For multi-part questions, address each part

Today's date: {date}"""

USER_TEMPLATE = """Context from documents:
{context}

{question}"""


class PromptBuilder:
    def build(
        self,
        query: str,
        chunks: list[ScoredChunk],
        conversation_history: list,
        summary: Optional[str] = None,
    ) -> list[dict]:
        """Build the full message list for the LLM."""
        from datetime import date

        messages = [{
            "role": "system",
            "content": SYSTEM_PROMPT.format(date=date.today().isoformat()),
        }]

        # Add conversation summary if exists
        if summary:
            messages.append({
                "role": "system",
                "content": f"Previous conversation summary:\n{summary}"
            })

        # Add recent history (excluding current query)
        for msg in (conversation_history[-8:] if conversation_history else []):
            messages.append({"role": msg.role, "content": msg.content})

        # Format context from retrieved chunks
        context_parts = []
        for i, chunk in enumerate(chunks, start=1):
            page_info = f" (Page {chunk.page_number})" if chunk.page_number else ""
            context_parts.append(
                f"[{i}] From: **{chunk.document_title}**{page_info}\n{chunk.content}"
            )
        context = "\n\n---\n\n".join(context_parts)

        # Add user query with context
        messages.append({
            "role": "user",
            "content": USER_TEMPLATE.format(context=context, question=query)
        })

        return messages
