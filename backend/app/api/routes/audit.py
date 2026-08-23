"""Audit log routes — query and export audit trail."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogListResponse

router = APIRouter()

_VIEWER_ROLES = ("INCIDENT_MANAGER", "ADMIN")


@router.get("", response_model=AuditLogListResponse)
def list_audit(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: int | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
):
    q = select(AuditLog)
    if user_id is not None:
        q = q.where(AuditLog.user_id == user_id)
    if action:
        q = q.where(AuditLog.action == action)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if from_date:
        q = q.where(AuditLog.created_at >= from_date)
    if to_date:
        q = q.where(AuditLog.created_at <= to_date)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = list(
        db.scalars(
            q.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return AuditLogListResponse(items=items, total=total, page=page, page_size=page_size)
