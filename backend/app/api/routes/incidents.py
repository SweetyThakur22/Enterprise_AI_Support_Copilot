"""Incidents and dashboard routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.analysis import AnalysisResultResponse
from app.schemas.incident import (
    DashboardStats, IncidentDetail, IncidentListResponse, LogFileResponse,
)
from app.services import incident_service

router = APIRouter()


@router.get("", response_model=IncidentListResponse)
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str | None = Query(None),
    application: str | None = Query(None),
    environment: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    items, total = incident_service.list_incidents(
        db, page=page, page_size=page_size,
        severity=severity, application=application,
        environment=environment, category=category, status=status,
    )
    return IncidentListResponse(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    inc = incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return inc


@router.get("/{incident_id}/logs", response_model=list[LogFileResponse])
def get_incident_logs(incident_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    inc = incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident_service.get_incident_logs(db, inc.id)


@router.get("/{incident_id}/analysis", response_model=AnalysisResultResponse | None)
def get_incident_analysis(incident_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    inc = incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident_service.get_latest_analysis(db, inc.id)
