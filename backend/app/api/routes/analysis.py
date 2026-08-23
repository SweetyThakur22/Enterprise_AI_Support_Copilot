"""Analysis routes — trigger and poll AI investigation pipeline."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.limiter import limiter
from app.models.analysis_result import AnalysisResult
from app.schemas.analysis import AnalysisResultResponse, TriggerAnalysisResponse
from app.services import analysis_orchestrator, incident_service

router = APIRouter()

_ANALYZE_ROLES = ("SUPPORT_ENGINEER", "INCIDENT_MANAGER", "ADMIN")


@router.post(
    "/incidents/{incident_id}/analyze",
    response_model=TriggerAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["analysis"],
)
@limiter.limit("10/hour")
def trigger_analysis(
    request: Request,
    incident_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*_ANALYZE_ROLES)),
):
    inc = incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    record = analysis_orchestrator.trigger_analysis(
        db=db,
        incident_id=inc.id,
        triggered_by=current_user.id,
    )

    background_tasks.add_task(
        analysis_orchestrator.run_analysis,
        db=db,
        incident_id=inc.id,
        analysis_id=record.id,
        triggered_by=current_user.id,
    )

    return TriggerAnalysisResponse(
        job_id=str(record.id),
        status="processing",
        message=f"Analysis started for {incident_id}. Poll GET /incidents/{incident_id}/analysis for results.",
    )


@router.get(
    "/incidents/{incident_id}/analysis",
    response_model=AnalysisResultResponse | None,
    tags=["analysis"],
)
def get_analysis(
    incident_id: str,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    inc = incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_service.get_latest_analysis(db, inc.id)


@router.get(
    "/analysis/{analysis_id}/evidence",
    tags=["analysis"],
)
def get_evidence(
    analysis_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    ar = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not ar:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    return ar.evidence or {}
