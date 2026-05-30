"""Analytics router — thin layer; all logic in AnalyticsService."""
from fastapi import APIRouter, Depends, Query

from core.dependencies import CurrentToken, DbSession
from modules.analytics.repository import AnalyticsRepository
from modules.analytics.service import AnalyticsService

router = APIRouter()


def _svc(db: DbSession) -> AnalyticsService:
    return AnalyticsService(AnalyticsRepository(db))


@router.get("/overview", summary="Dashboard overview metrics")
async def get_overview(
    token: CurrentToken,
    service: AnalyticsService = Depends(_svc),
):
    return await service.get_overview(token.tenant_id)


@router.get("/activity", summary="Document upload activity time series")
async def get_activity(
    token: CurrentToken,
    service: AnalyticsService = Depends(_svc),
    days: int = Query(default=30, ge=7, le=365),
):
    data = await service.get_activity(token.tenant_id, days=days)
    return {"activity": data, "days": days}
