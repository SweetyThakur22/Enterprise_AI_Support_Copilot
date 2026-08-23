"""SQLAlchemy model registry — import all models so Alembic can detect them."""
from app.models.user import User, UserRole
from app.models.incident import Incident, IncidentSeverity, IncidentCategory, IncidentStatus, IncidentEnvironment
from app.models.log_file import LogFile
from app.models.kb_document import KbDocument
from app.models.kb_chunk import KbChunk
from app.models.analysis_result import AnalysisResult, AnalysisStatus, RiskLevel
from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.models.audit_log import AuditLog

__all__ = [
    "User", "UserRole",
    "Incident", "IncidentSeverity", "IncidentCategory", "IncidentStatus", "IncidentEnvironment",
    "LogFile",
    "KbDocument",
    "KbChunk",
    "AnalysisResult", "AnalysisStatus", "RiskLevel",
    "ApprovalRequest", "ApprovalStatus",
    "AuditLog",
]
