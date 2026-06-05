"""
DocuMind FastAPI Application — Main entry point.
Configures middleware, routers, lifespan, and exception handlers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from config import settings
from core.exceptions import DocuMindError
from database import close_db
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis_client import close_redis, get_redis_pool

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # ── Startup ──
    logger.info("documind.startup", env=settings.APP_ENV, version=settings.APP_VERSION)

    # Initialize Redis connection pool
    await get_redis_pool()
    logger.info("redis.connected")

    yield

    # ── Shutdown ──
    logger.info("documind.shutdown")
    await close_db()
    await close_redis()


def create_application() -> FastAPI:
    """Application factory pattern."""
    app = FastAPI(
        title="DocuMind API",
        description="Multi-tenant enterprise document intelligence platform powered by RAG",
        version=settings.APP_VERSION,
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Middleware (order matters — outermost executes first on request) ──

    # CORS (must be first to handle preflight)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
    )

    # Request ID middleware
    from core.middleware.request_id import RequestIDMiddleware

    app.add_middleware(RequestIDMiddleware)

    # Rate limiting middleware (sliding-window, Redis-backed)
    from core.middleware.rate_limit import RateLimitMiddleware

    app.add_middleware(RateLimitMiddleware)

    # Tenant context middleware
    from core.middleware.tenant import TenantMiddleware

    app.add_middleware(TenantMiddleware)

    # ── Routers ──
    from modules.admin.router import router as admin_router
    from modules.analytics.router import router as analytics_router
    from modules.apikey.router import router as apikey_router
    from modules.audit.router import router as audit_router
    from modules.auth.router import router as auth_router
    from modules.chat.router import router as chat_router
    from modules.document.router import router as document_router
    from modules.ingestion.router import router as ingestion_router
    from modules.search.router import router as search_router
    from modules.tenant.router import router as tenant_router
    from modules.user.router import router as user_router
    from modules.webhook.router import router as webhook_router

    api_prefix = settings.API_PREFIX

    app.include_router(
        auth_router, prefix=f"{api_prefix}/auth", tags=["Authentication"]
    )
    app.include_router(user_router, prefix=f"{api_prefix}/users", tags=["Users"])
    app.include_router(tenant_router, prefix=f"{api_prefix}/tenants", tags=["Tenants"])
    app.include_router(
        document_router, prefix=f"{api_prefix}/documents", tags=["Documents"]
    )
    app.include_router(
        ingestion_router, prefix=f"{api_prefix}/ingestion", tags=["Ingestion"]
    )
    app.include_router(search_router, prefix=f"{api_prefix}/search", tags=["Search"])
    app.include_router(chat_router, prefix=f"{api_prefix}/conversations", tags=["Chat"])
    app.include_router(audit_router, prefix=f"{api_prefix}/audit", tags=["Audit"])
    app.include_router(
        analytics_router, prefix=f"{api_prefix}/analytics", tags=["Analytics"]
    )
    app.include_router(admin_router, prefix=f"{api_prefix}/admin", tags=["Admin"])
    app.include_router(
        apikey_router, prefix=f"{api_prefix}/api-keys", tags=["API Keys"]
    )
    app.include_router(
        webhook_router, prefix=f"{api_prefix}/webhooks", tags=["Webhooks"]
    )

    # ── Exception Handlers ──

    @app.exception_handler(DocuMindError)
    async def documind_exception_handler(request: Request, exc: DocuMindError):
        logger.warning(
            "api.error",
            error_code=exc.error_code,
            status_code=exc.status_code,
            path=str(request.url),
            request_id=getattr(request.state, "request_id", None),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "request_id": getattr(request.state, "request_id", None),
                }
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "api.unhandled_error",
            path=str(request.url),
            request_id=getattr(request.state, "request_id", None),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": getattr(request.state, "request_id", None),
                }
            },
        )

    # ── Health Check Endpoints ──

    @app.get("/health", tags=["Health"], include_in_schema=False)
    async def health():
        return {"status": "ok", "version": settings.APP_VERSION}

    @app.get("/health/detailed", tags=["Health"], include_in_schema=False)
    async def health_detailed() -> dict:
        from database import engine

        checks: dict[str, str] = {}

        # Database check
        try:
            async with engine.connect() as conn:
                from sqlalchemy import text

                await conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {e}"

        # Redis check
        try:
            redis = await get_redis_pool()
            await redis.ping()
            checks["redis"] = "ok"
        except Exception as e:
            checks["redis"] = f"error: {e}"

        overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
        return {"status": overall, "checks": checks, "version": settings.APP_VERSION}

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower(),
    )
