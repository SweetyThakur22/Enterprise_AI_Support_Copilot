"""Pydantic schemas for analysis endpoints."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.analysis_result import AnalysisStatus, RiskLevel


class EvidenceItem(BaseModel):
    source: str
    chunk_id: int
    text: str
    score: float


class TimelineEvent(BaseModel):
    timestamp: str
    level: str
    message: str


class Recommendation(BaseModel):
    text: str
    risk_level: str
    requires_approval: bool
    action_type: str | None = None


class AnalysisResultResponse(BaseModel):
    id: int
    incident_id: int
    triggered_by: int | None
    status: AnalysisStatus
    classification: str | None
    root_cause: str | None
    confidence: int | None
    evidence: Any | None
    recommendations: Any | None
    risk_level: RiskLevel | None
    requires_approval: bool
    llm_model: str | None
    token_usage: int | None
    latency_ms: int | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TriggerAnalysisResponse(BaseModel):
    job_id: str
    status: str
    message: str
