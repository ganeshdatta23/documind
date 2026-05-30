"""
DocuMind Redis Client — Connection pool, cache utilities, rate limiting helpers.
"""
from collections.abc import AsyncGenerator
from typing import Any

import redis.asyncio as aioredis

from config import settings

# Global Redis connection pool
_redis_pool: aioredis.Redis | None = None


async def get_redis_pool() -> aioredis.Redis:
    """Get or create Redis connection pool (singleton)."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """FastAPI dependency: yields Redis connection."""
    pool = await get_redis_pool()
    yield pool


async def close_redis() -> None:
    """Close Redis connection pool. Called on shutdown."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None


# ─── Cache Utilities ──────────────────────────────────────────────────────────

class RedisCache:
    """High-level cache wrapper with JSON serialization."""

    def __init__(self, redis: aioredis.Redis, prefix: str = "cache"):
        self.redis = redis
        self.prefix = prefix

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    async def get(self, key: str) -> Any | None:
        import json
        value = await self.redis.get(self._key(key))
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        import json
        serialized = json.dumps(value) if not isinstance(value, str) else value
        await self.redis.setex(self._key(key), ttl_seconds, serialized)

    async def delete(self, key: str) -> None:
        await self.redis.delete(self._key(key))

    async def exists(self, key: str) -> bool:
        return bool(await self.redis.exists(self._key(key)))

    async def invalidate_prefix(self, prefix: str) -> int:
        """Delete all keys matching a prefix pattern."""
        pattern = f"{self.prefix}:{prefix}*"
        keys = await self.redis.keys(pattern)
        if keys:
            return await self.redis.delete(*keys)
        return 0


# ─── Rate Limiting ────────────────────────────────────────────────────────────

class SlidingWindowRateLimiter:
    """
    Redis-based sliding window rate limiter.
    Uses sorted sets with timestamp as score for accurate windowing.
    """

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    async def is_allowed(
        self,
        identifier: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int, int]:
        """
        Check if request is allowed.
        Returns: (is_allowed, requests_remaining, reset_after_seconds)
        """
        import time

        now = time.time()
        window_start = now - window_seconds
        key = f"rate_limit:{identifier}"

        # Remove old entries outside window
        await self.redis.zremrangebyscore(key, 0, window_start)

        # Count current requests
        current_count = await self.redis.zcard(key)

        if current_count >= max_requests:
            oldest = await self.redis.zrange(key, 0, 0, withscores=True)
            reset_after = int(window_seconds - (now - oldest[0][1])) if oldest else window_seconds
            return False, 0, reset_after

        # Add current request
        await self.redis.zadd(key, {f"{now}": now})
        await self.redis.expire(key, window_seconds)

        remaining = max_requests - current_count - 1
        return True, remaining, window_seconds


# ─── Token Blocklist ──────────────────────────────────────────────────────────

async def blocklist_token(redis: aioredis.Redis, jti: str, expire_seconds: int) -> None:
    """Add JWT ID to blocklist (for logout/revocation)."""
    await redis.setex(f"blocklist:{jti}", expire_seconds, "1")


async def is_token_blocked(redis: aioredis.Redis, jti: str) -> bool:
    """Check if JWT ID is in blocklist."""
    return bool(await redis.exists(f"blocklist:{jti}"))
