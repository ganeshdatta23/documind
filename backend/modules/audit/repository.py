"""Audit repository — corrected to use AuditLog.metadata_ (ORM field name)."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import AuditLog


class AuditRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        *,
        tenant_id: UUID,
        actor_id: Optional[UUID],
        actor_type: str,
        action: str,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        status: str = "success",
    ) -> AuditLog:
        log = AuditLog(
            tenant_id=tenant_id,
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            metadata_=metadata or {},   # ORM maps metadata_ → "metadata" column
            status=status,
        )
        self.db.add(log)
        await self.db.flush()
        return log

    async def list(
        self,
        tenant_id: UUID,
        *,
        actor_id: Optional[UUID] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        q = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
        if actor_id:
            q = q.where(AuditLog.actor_id == actor_id)
        if action:
            q = q.where(AuditLog.action == action)
        if resource_type:
            q = q.where(AuditLog.resource_type == resource_type)
        if since:
            q = q.where(AuditLog.created_at >= since)
        if until:
            q = q.where(AuditLog.created_at <= until)

        total = await self.db.scalar(
            select(func.count()).select_from(q.subquery())
        )
        result = await self.db.execute(
            q.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total or 0
