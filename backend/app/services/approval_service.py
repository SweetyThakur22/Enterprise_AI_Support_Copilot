"""Approval workflow service — create, list, approve, reject approval requests."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.services import audit_service


_SIMULATED_RESULTS = {
    "DBA_ACTION": "Simulation: TEMP tablespace extension request submitted to DBA queue. Ticket DBA-{id} created.",
    "RESTART": "Simulation: Service restart scheduled via runbook executor. ETA 2 minutes.",
    "SCALE": "Simulation: Auto-scaling policy updated. New capacity active within 5 minutes.",
    "CONFIG": "Simulation: Configuration change submitted to change management pipeline.",
}


def create_approval(
    db: Session,
    analysis_id: int,
    recommendation_index: int,
    recommendation_text: str,
    risk_level: str,
    requested_by: int,
) -> ApprovalRequest:
    request = ApprovalRequest(
        analysis_id=analysis_id,
        recommendation_index=recommendation_index,
        recommendation_text=recommendation_text,
        risk_level=risk_level,
        status=ApprovalStatus.PENDING,
        requested_by=requested_by,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    audit_service.log_action(
        db=db,
        action="APPROVAL_REQUESTED",
        entity_type="approval_request",
        entity_id=str(request.id),
        user_id=requested_by,
        details={"analysis_id": analysis_id, "risk_level": risk_level},
    )
    return request


def list_pending(db: Session) -> list[ApprovalRequest]:
    return list(
        db.scalars(
            select(ApprovalRequest)
            .where(ApprovalRequest.status == ApprovalStatus.PENDING)
            .order_by(ApprovalRequest.requested_at.desc())
        ).all()
    )


def list_all(db: Session, status: Optional[str] = None) -> list[ApprovalRequest]:
    q = select(ApprovalRequest)
    if status:
        q = q.where(ApprovalRequest.status == status)
    return list(db.scalars(q.order_by(ApprovalRequest.requested_at.desc())).all())


def get_approval(db: Session, approval_id: int) -> Optional[ApprovalRequest]:
    return db.get(ApprovalRequest, approval_id)


def approve(
    db: Session,
    approval: ApprovalRequest,
    reviewer_id: int,
    comment: Optional[str] = None,
) -> ApprovalRequest:
    action_type = None
    text_lower = (approval.recommendation_text or '').lower()
    if 'temp' in text_lower or 'tablespace' in text_lower or 'dba' in text_lower:
        action_type = 'DBA_ACTION'
    elif 'restart' in text_lower:
        action_type = 'RESTART'
    elif 'scale' in text_lower:
        action_type = 'SCALE'
    elif 'config' in text_lower:
        action_type = 'CONFIG'

    template = _SIMULATED_RESULTS.get(action_type or '', "Simulation: Action executed successfully.")
    simulated = template.replace('{id}', str(approval.id))

    approval.status = ApprovalStatus.APPROVED
    approval.reviewed_by = reviewer_id
    approval.review_comment = comment
    approval.simulated_result = simulated
    approval.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(approval)

    audit_service.log_action(
        db=db,
        action="APPROVAL_APPROVED",
        entity_type="approval_request",
        entity_id=str(approval.id),
        user_id=reviewer_id,
        details={"comment": comment, "simulated_result": simulated},
    )
    return approval


def reject(
    db: Session,
    approval: ApprovalRequest,
    reviewer_id: int,
    comment: str,
) -> ApprovalRequest:
    approval.status = ApprovalStatus.REJECTED
    approval.reviewed_by = reviewer_id
    approval.review_comment = comment
    approval.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(approval)

    audit_service.log_action(
        db=db,
        action="APPROVAL_REJECTED",
        entity_type="approval_request",
        entity_id=str(approval.id),
        user_id=reviewer_id,
        details={"comment": comment},
    )
    return approval
