"""Incident database queries."""
from datetime import datetime, timezone, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.analysis_result import AnalysisResult, AnalysisStatus
from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.log_file import LogFile


def list_incidents(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    severity: str | None = None,
    application: str | None = None,
    environment: str | None = None,
    category: str | None = None,
    status: str | None = None,
):
    q = select(Incident)
    if severity:
        q = q.where(Incident.severity == severity)
    if application:
        q = q.where(Incident.application == application)
    if environment:
        q = q.where(Incident.environment == environment)
    if category:
        q = q.where(Incident.category == category)
    if status:
        q = q.where(Incident.status == status)

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = db.scalars(q.order_by(Incident.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return items, total


def get_incident(db: Session, incident_id: str) -> Incident | None:
    return db.scalars(select(Incident).where(Incident.incident_id == incident_id)).first()


def get_incident_logs(db: Session, incident_pk: int) -> list[LogFile]:
    return list(db.scalars(select(LogFile).where(LogFile.incident_id == incident_pk)).all())


def get_latest_analysis(db: Session, incident_pk: int) -> AnalysisResult | None:
    return db.scalars(
        select(AnalysisResult)
        .where(AnalysisResult.incident_id == incident_pk)
        .order_by(AnalysisResult.created_at.desc())
    ).first()


def get_dashboard_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    incidents_this_week = db.scalar(
        select(func.count(Incident.id)).where(Incident.created_at >= week_ago)
    ) or 0

    open_incidents = db.scalar(
        select(func.count(Incident.id)).where(Incident.status == IncidentStatus.OPEN)
    ) or 0

    p1_incidents = db.scalar(
        select(func.count(Incident.id)).where(
            Incident.severity == IncidentSeverity.P1,
            Incident.status != IncidentStatus.RESOLVED,
        )
    ) or 0

    ai_analyzed = db.scalar(
        select(func.count(AnalysisResult.id)).where(AnalysisResult.status == AnalysisStatus.COMPLETED)
    ) or 0

    pending_approvals = db.scalar(
        select(func.count(ApprovalRequest.id)).where(ApprovalRequest.status == ApprovalStatus.PENDING)
    ) or 0

    avg_conf_row = db.scalar(
        select(func.avg(AnalysisResult.confidence)).where(
            AnalysisResult.status == AnalysisStatus.COMPLETED,
            AnalysisResult.confidence.isnot(None),
        )
    )
    avg_confidence = round(float(avg_conf_row), 1) if avg_conf_row else None

    # Incidents by application
    by_app_rows = db.execute(
        select(Incident.application, func.count(Incident.id).label("n")).group_by(Incident.application)
    ).all()
    incidents_by_application = {row.application: row.n for row in by_app_rows}

    # Incidents by severity
    by_sev_rows = db.execute(
        select(Incident.severity, func.count(Incident.id).label("n")).group_by(Incident.severity)
    ).all()
    incidents_by_severity = {row.severity.value: row.n for row in by_sev_rows}

    # Last 7 days daily counts
    incidents_last_7_days = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.scalar(
            select(func.count(Incident.id)).where(
                Incident.created_at >= day_start,
                Incident.created_at < day_end,
            )
        ) or 0
        incidents_last_7_days.append({"date": day_start.strftime("%Y-%m-%d"), "count": count})

    recent_incidents = list(
        db.scalars(select(Incident).order_by(Incident.created_at.desc()).limit(5)).all()
    )

    avg_latency_row = db.scalar(
        select(func.avg(AnalysisResult.latency_ms)).where(
            AnalysisResult.status == AnalysisStatus.COMPLETED,
            AnalysisResult.latency_ms.isnot(None),
        )
    )
    avg_latency_ms = round(float(avg_latency_row)) if avg_latency_row else None

    resolved_this_week = db.scalar(
        select(func.count(Incident.id)).where(
            Incident.status == IncidentStatus.RESOLVED,
            Incident.updated_at >= week_ago,
        )
    ) or 0

    return {
        "incidents_this_week": incidents_this_week,
        "open_incidents": open_incidents,
        "p1_incidents": p1_incidents,
        "ai_analyzed_count": ai_analyzed,
        "pending_approvals": pending_approvals,
        "avg_confidence": avg_confidence,
        "avg_latency_ms": avg_latency_ms,
        "resolved_this_week": resolved_this_week,
        "incidents_by_application": incidents_by_application,
        "incidents_by_severity": incidents_by_severity,
        "incidents_last_7_days": incidents_last_7_days,
        "recent_incidents": recent_incidents,
    }
