"""Admin router — superadmin-only endpoints, delegates to AdminService."""
from fastapi import APIRouter, Depends

from core.dependencies import DbSession, SuperAdmin
from modules.admin.repository import AdminRepository
from modules.admin.service import AdminService

router = APIRouter()


def _svc(db: DbSession) -> AdminService:
    return AdminService(AdminRepository(db))


@router.get("/platform/stats", summary="Platform-wide statistics (superadmin)")
async def platform_stats(
    _: SuperAdmin,
    service: AdminService = Depends(_svc),
):
    return await service.get_platform_stats()
