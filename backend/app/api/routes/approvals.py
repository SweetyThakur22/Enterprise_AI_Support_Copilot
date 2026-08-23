"""Approval workflow routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.schemas.approval import ApprovalDecision, ApprovalDetail, ApprovalListItem
from app.services import approval_service

router = APIRouter()

_REVIEWER_ROLES = ("INCIDENT_MANAGER", "ADMIN")


@router.get("", response_model=list[ApprovalListItem])
def list_approvals(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user=Depends(require_role(*_REVIEWER_ROLES)),
):
    return approval_service.list_all(db, status=status_filter)


@router.get("/{approval_id}", response_model=ApprovalDetail)
def get_approval(
    approval_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_role(*_REVIEWER_ROLES)),
):
    ar = approval_service.get_approval(db, approval_id)
    if not ar:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return ar


@router.post("/{approval_id}/approve", response_model=ApprovalDetail)
def approve(
    approval_id: int,
    body: ApprovalDecision,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*_REVIEWER_ROLES)),
):
    ar = approval_service.get_approval(db, approval_id)
    if not ar:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if ar.status.value != "PENDING":
        raise HTTPException(status_code=400, detail="Approval request is not pending")
    return approval_service.approve(db, ar, reviewer_id=current_user.id, comment=body.comment)


@router.post("/{approval_id}/reject", response_model=ApprovalDetail)
def reject(
    approval_id: int,
    body: ApprovalDecision,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*_REVIEWER_ROLES)),
):
    ar = approval_service.get_approval(db, approval_id)
    if not ar:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if ar.status.value != "PENDING":
        raise HTTPException(status_code=400, detail="Approval request is not pending")
    if not body.comment:
        raise HTTPException(status_code=422, detail="A comment is required when rejecting")
    return approval_service.reject(db, ar, reviewer_id=current_user.id, comment=body.comment)
