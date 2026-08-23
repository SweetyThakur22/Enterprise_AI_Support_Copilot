"""Approval workflow endpoint tests."""
import pytest
from datetime import datetime, timezone

from app.models.incident import Incident, IncidentSeverity, IncidentCategory, IncidentStatus, IncidentEnvironment
from app.models.analysis_result import AnalysisResult, AnalysisStatus, RiskLevel
from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.models.audit_log import AuditLog


def _make_incident(db):
    inc = Incident(
        incident_id="INC-10492",
        title="Billing Failure",
        description="ORA-01652",
        application="Billing Platform",
        environment=IncidentEnvironment.PROD,
        severity=IncidentSeverity.P1,
        category=IncidentCategory.DATABASE,
        status=IncidentStatus.OPEN,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(inc)
    db.flush()
    return inc


def _make_analysis(db, incident_pk, user_pk):
    ar = AnalysisResult(
        incident_id=incident_pk,
        triggered_by=user_pk,
        status=AnalysisStatus.COMPLETED,
        classification="DB",
        root_cause="TEMP exhausted",
        confidence=91,
        risk_level=RiskLevel.HIGH,
        requires_approval=True,
    )
    db.add(ar)
    db.flush()
    return ar


def _make_approval(db, analysis_pk, user_pk):
    req = ApprovalRequest(
        analysis_id=analysis_pk,
        recommendation_index=0,
        recommendation_text="Extend TEMP tablespace by 20GB",
        risk_level="HIGH",
        status=ApprovalStatus.PENDING,
        requested_by=user_pk,
        requested_at=datetime.now(timezone.utc),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def test_list_approvals_as_manager(client, manager_token, db, manager_user):
    inc = _make_incident(db)
    ar = _make_analysis(db, inc.id, manager_user.id)
    _make_approval(db, ar.id, manager_user.id)

    res = client.get("/approvals", headers={"Authorization": f"Bearer {manager_token}"})
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    assert items[0]["risk_level"] == "HIGH"


def test_list_approvals_as_engineer(client, engineer_token):
    res = client.get("/approvals", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 403


def test_approve_creates_audit_record(client, manager_token, db, manager_user):
    inc = _make_incident(db)
    ar = _make_analysis(db, inc.id, manager_user.id)
    req = _make_approval(db, ar.id, manager_user.id)

    res = client.post(
        f"/approvals/{req.id}/approve",
        json={"comment": "Approved by DBA team"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPROVED"
    assert data["simulated_result"] is not None

    # Verify audit record created
    audit = db.query(AuditLog).filter(
        AuditLog.action == "APPROVAL_APPROVED",
        AuditLog.entity_id == str(req.id),
    ).first()
    assert audit is not None


def test_reject_requires_comment(client, manager_token, db, manager_user):
    inc = _make_incident(db)
    ar = _make_analysis(db, inc.id, manager_user.id)
    req = _make_approval(db, ar.id, manager_user.id)

    # Reject without comment → 422
    res = client.post(
        f"/approvals/{req.id}/reject",
        json={},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert res.status_code == 422

    # Reject with comment → 200
    res = client.post(
        f"/approvals/{req.id}/reject",
        json={"comment": "Risk too high at this time"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert data["review_comment"] == "Risk too high at this time"
