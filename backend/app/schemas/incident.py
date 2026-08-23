"""Pydantic schemas for incident endpoints."""
from datetime import datetime

from pydantic import BaseModel

from app.models.incident import IncidentCategory, IncidentEnvironment, IncidentSeverity, IncidentStatus


class IncidentListItem(BaseModel):
    id: int
    incident_id: str
    title: str
    application: str
    environment: IncidentEnvironment
    severity: IncidentSeverity
    category: IncidentCategory
    status: IncidentStatus
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IncidentDetail(IncidentListItem):
    description: str


class LogFileResponse(BaseModel):
    id: int
    incident_id: int
    filename: str
    content: str
    file_size: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    items: list[IncidentListItem]
    total: int
    page: int
    page_size: int


class DashboardStats(BaseModel):
    incidents_this_week: int
    open_incidents: int
    p1_incidents: int
    ai_analyzed_count: int
    pending_approvals: int
    avg_confidence: float | None
    incidents_by_application: dict[str, int]
    incidents_by_severity: dict[str, int]
    incidents_last_7_days: list[dict]
    recent_incidents: list[IncidentListItem]
