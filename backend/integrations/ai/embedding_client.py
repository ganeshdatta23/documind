"""Embedding client — OpenAI embeddings with Redis caching."""
from __future__ import annotations

import hashlib
import json
from typing import Optional

from openai import AsyncOpenAI

from config import settings


class EmbeddingClient:
    def __init__(self, redis=None) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL
        )
        self.redis = redis
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS

    def _embed_kwargs(self, payload) -> dict:
        """Build embeddings.create kwargs, sending `dimensions` only when the
        provider supports it (OpenAI does; Gemini and most others don't)."""
        kwargs: dict = {"model": self.model, "input": payload}
        if settings.EMBEDDING_SEND_DIMENSIONS:
            kwargs["dimensions"] = self.dimensions
        return kwargs

    def _cache_key(self, text: str) -> str:
        # Namespacing by model + dimensions prevents serving a vector produced by
        # a different model/size after a config change. Embeddings are a pure
        # function of (text, model, dimensions), so caching is tenant-agnostic.
        digest = hashlib.sha256(text.encode()).hexdigest()
        return f"embed:{self.model}:{self.dimensions}:{digest}"

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query with Redis caching."""
        cache_key = self._cache_key(text)

        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        response = await self.client.embeddings.create(**self._embed_kwargs(text))
        embedding = response.data[0].embedding

        if self.redis:
            await self.redis.setex(cache_key, 86400, json.dumps(embedding))

        return embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in batches."""
        all_embeddings = []
        batch_size = settings.EMBEDDING_BATCH_SIZE

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = await self.client.embeddings.create(**self._embed_kwargs(batch))
            all_embeddings.extend([e.embedding for e in response.data])

        return all_embeddings
