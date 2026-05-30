"""Embedding client — OpenAI embeddings with Redis caching."""
import hashlib
import json
from typing import Optional

from openai import AsyncOpenAI

from config import settings


class EmbeddingClient:
    def __init__(self, redis=None) -> None:
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.redis = redis
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query with Redis caching."""
        cache_key = f"embed:{hashlib.sha256(text.encode()).hexdigest()}"

        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
            dimensions=self.dimensions,
        )
        embedding = response.data[0].embedding

        if self.redis:
            await self.redis.setex(cache_key, 3600, json.dumps(embedding))

        return embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in batches."""
        all_embeddings = []
        batch_size = settings.EMBEDDING_BATCH_SIZE

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = await self.client.embeddings.create(
                model=self.model,
                input=batch,
                dimensions=self.dimensions,
            )
            all_embeddings.extend([e.embedding for e in response.data])

        return all_embeddings
