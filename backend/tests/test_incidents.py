"""Incident endpoint tests."""
import pytest
from app.models.incident import Incident, IncidentSeverity, IncidentCategory, IncidentStatus, IncidentEnvironment
from datetime import datetime, timezone


def make_incident(db, incident_id="INC-10492", severity=IncidentSeverity.P1, application="Billing Platform", status=IncidentStatus.OPEN):
    inc = Incident(
        incident_id=incident_id,
        title=f"Test Incident {incident_id}",
        description="Test description",
        application=application,
        environment=IncidentEnvironment.PROD,
        severity=severity,
        category=IncidentCategory.DATABASE,
        status=status,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc


def test_list_incidents_paginated(client, engineer_token, db):
    for i in range(5):
        make_incident(db, incident_id=f"INC-{i+1000:05d}")
    res = client.get("/incidents?page=1&page_size=3", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3
    assert data["page"] == 1


def test_filter_by_severity(client, engineer_token, db):
    make_incident(db, incident_id="INC-00001", severity=IncidentSeverity.P1)
    make_incident(db, incident_id="INC-00002", severity=IncidentSeverity.P4)
    res = client.get("/incidents?severity=P1", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(i["severity"] == "P1" for i in items)


def test_filter_by_application(client, engineer_token, db):
    make_incident(db, incident_id="INC-00001", application="Billing Platform")
    make_incident(db, incident_id="INC-00002", application="API Gateway")
    res = client.get("/incidents?application=Billing+Platform", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(i["application"] == "Billing Platform" for i in items)


def test_incident_detail_found(client, engineer_token, db):
    make_incident(db)
    res = client.get("/incidents/INC-10492", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["incident_id"] == "INC-10492"
    assert data["severity"] == "P1"
    assert "description" in data


def test_incident_not_found(client, engineer_token):
    res = client.get("/incidents/INC-99999", headers={"Authorization": f"Bearer {engineer_token}"})
    assert res.status_code == 404


def test_list_requires_auth(client):
    res = client.get("/incidents")
    assert res.status_code in (401, 403)
