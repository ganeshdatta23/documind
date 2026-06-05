"""
DocuMind Redis Client — Connection pool, cache utilities, rate limiting helpers.
"""
from __future__ import annotations

import secrets
from collections.abc import AsyncGenerator, Awaitable
from typing import Any, cast

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

    Uses a sorted set with timestamp as score. The check-and-increment runs as a
    single atomic Lua script so concurrent requests can't both slip past the
    limit in the gap between counting and adding.
    """

    # KEYS[1]=key  ARGV[1]=now  ARGV[2]=window  ARGV[3]=max  ARGV[4]=member
    _SCRIPT = """
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local member = ARGV[4]
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    local count = redis.call('ZCARD', key)
    if count >= max_requests then
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local reset_after = window
        if oldest[2] then reset_after = math.ceil(window - (now - tonumber(oldest[2]))) end
        return {0, 0, reset_after}
    end
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, window)
    return {1, max_requests - count - 1, window}
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
        key = f"rate_limit:{identifier}"
        # Unique member per call so identical timestamps don't collide in the set.
        member = f"{now}:{secrets.token_hex(4)}"

        try:
            # redis-py types eval() as sync|async; cast to the awaitable we know
            # we get from the async client so the result unpacks cleanly.
            allowed, remaining, reset_after = await cast(
                "Awaitable[Any]",
                self.redis.eval(
                    self._SCRIPT, 1, key, str(now), str(window_seconds), str(max_requests), member
                ),
            )
        except Exception:
            # Fail open — never let a Redis hiccup block all traffic.
            return True, max_requests - 1, window_seconds

        return bool(allowed), int(remaining), int(reset_after)


# ─── Token Blocklist ──────────────────────────────────────────────────────────

async def blocklist_token(redis: aioredis.Redis, jti: str, expire_seconds: int) -> None:
    """Add JWT ID to blocklist (for logout/revocation)."""
    await redis.setex(f"blocklist:{jti}", expire_seconds, "1")


async def is_token_blocked(redis: aioredis.Redis, jti: str) -> bool:
    """Check if JWT ID is in blocklist."""
    return bool(await redis.exists(f"blocklist:{jti}"))
