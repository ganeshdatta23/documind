"""
Tenant middleware — loads and caches tenant context per request.
Extracts tenant from JWT or X-Tenant-ID header and injects into request state.
"""
from __future__ import annotations

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)

# Paths that bypass tenant resolution
EXEMPT_PATHS = {
    "/health",
    "/health/detailed",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
}


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        # Tenant ID will be resolved from JWT in the auth dependency
        # Here we just initialize the tenant state container
        request.state.tenant_id = None
        request.state.tenant = None

        response = await call_next(request)
        return response
