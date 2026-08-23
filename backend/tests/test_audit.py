"""Audit log endpoint tests."""
import pytest
from app.services.audit_service import log_action


def test_audit_requires_manager(client, engineer_token):
    res = client.get("/audit", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 403


def test_audit_list_as_manager(client, manager_token, db, manager_user):
    log_action(db, action="TEST_ACTION", entity_type="test", entity_id="1", user_id=manager_user.id)
    res = client.get("/audit", headers={"Authorization": f"Bearer {manager_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(item["action"] == "TEST_ACTION" for item in data["items"])


def test_audit_filter_by_action(client, manager_token, db, manager_user):
    log_action(db, action="ANALYSIS_TRIGGERED", entity_type="incident", entity_id="5", user_id=manager_user.id)
    log_action(db, action="APPROVAL_APPROVED", entity_type="approval_request", entity_id="1", user_id=manager_user.id)

    res = client.get("/audit?action=ANALYSIS_TRIGGERED", headers={"Authorization": f"Bearer {manager_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(i["action"] == "ANALYSIS_TRIGGERED" for i in items)


def test_audit_records_have_correct_fields(client, manager_token, db, manager_user):
    log_action(db, action="LOGIN", entity_type="user", entity_id=str(manager_user.id),
               user_id=manager_user.id, details={"source": "web"})

    res = client.get("/audit?action=LOGIN", headers={"Authorization": f"Bearer {manager_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    record = items[0]
    assert "created_at" in record
    assert "user_id" in record
    assert "entity_type" in record
    assert record["details"]["source"] == "web"
