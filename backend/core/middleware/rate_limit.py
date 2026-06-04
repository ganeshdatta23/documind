"""
Rate limiting middleware — sliding-window per-identifier limiter backed by Redis.

Identifier preference: authenticated user (JWT sub) → client IP. Exempt paths
(health checks, etc.) bypass the limiter. Adds X-RateLimit-Remaining and, on a
429, a Retry-After header.
"""
from __future__ import annotations

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import settings

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.RATE_LIMIT_ENABLED or request.url.path in settings.RATE_LIMIT_EXEMPT_PATHS:
            return await call_next(request)

        try:
            from redis_client import SlidingWindowRateLimiter, get_redis_pool
            redis = await get_redis_pool()
            limiter = SlidingWindowRateLimiter(redis)
            identifier = self._identify(request)
            allowed, remaining, reset_after = await limiter.is_allowed(
                identifier,
                settings.RATE_LIMIT_DEFAULT_REQUESTS,
                settings.RATE_LIMIT_DEFAULT_WINDOW_SECONDS,
            )
        except Exception:
            # Fail open if Redis is unavailable.
            return await call_next(request)

        if not allowed:
            request_id = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Rate limit exceeded. Please try again later.",
                        "request_id": request_id,
                    }
                },
                headers={"Retry-After": str(reset_after), "X-RateLimit-Remaining": "0"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

    @staticmethod
    def _identify(request: Request) -> str:
        """Prefer the JWT subject; fall back to client IP."""
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                from security import decode_access_token
                payload = decode_access_token(auth.split(" ", 1)[1])
                return f"user:{payload.get('sub')}"
            except Exception:
                pass
        client = request.client.host if request.client else "unknown"
        return f"ip:{client}"
