"""Seed 25 incidents including the required INC-10492 and INC-9821."""
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.incident import (
    Incident, IncidentSeverity, IncidentCategory, IncidentStatus, IncidentEnvironment
)

def dt(days_ago: int, hour: int = 9, minute: int = 0) -> datetime:
    base = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)

INCIDENTS = [
    # ── REQUIRED DEMO INCIDENT ──────────────────────────────────────────────────
    {
        "incident_id": "INC-10492",
        "title": "Billing Batch Job Failure - ORA-01652 TEMP Segment Exhaustion",
        "description": (
            "The nightly billing batch job (BILL_BATCH_JOB_001) failed at 02:15 UTC "
            "with ORA-01652: unable to extend temp segment by 128 in tablespace TEMP. "
            "Approximately 847,293 of 1,200,000 customer records processed before failure. "
            "Monthly billing run for enterprise customers is blocked. Revenue impact estimated "
            "at £2.3M per hour delay. DBA team notified, incident escalated to P1."
        ),
        "application": "Billing Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P1,
        "category": IncidentCategory.DATABASE,
        "status": IncidentStatus.OPEN,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(0, 2, 16),
    },

    # ── HISTORICAL RESOLVED: INC-9821 (Oracle TEMP, similar to INC-10492) ───────
    {
        "incident_id": "INC-9821",
        "title": "Billing Batch ORA-01652 TEMP Tablespace Exhaustion - Monthly Run",
        "description": (
            "Monthly billing batch failed with ORA-01652 during large sort operation. "
            "TEMP tablespace at 100% utilisation. DBA team extended TEMP tablespace from "
            "50GB to 80GB and restarted batch. Job completed successfully within 2 hours. "
            "Root cause: increased customer base since last TEMP sizing review 6 months prior."
        ),
        "application": "Billing Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P1,
        "category": IncidentCategory.DATABASE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(45, 2, 10),
    },

    # ── OPEN / IN-PROGRESS INCIDENTS ─────────────────────────────────────────────
    {
        "incident_id": "INC-10489",
        "title": "Payment Gateway HTTP 502 Errors - Checkout Failures",
        "description": (
            "Payment Processing service returning HTTP 502 Bad Gateway from upstream provider. "
            "Approximately 12% of checkout requests failing. Card tokenisation endpoint "
            "intermittently unreachable. Customer-facing checkout page showing error state."
        ),
        "application": "Payment Processing",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P1,
        "category": IncidentCategory.API,
        "status": IncidentStatus.IN_PROGRESS,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(0, 6, 30),
    },
    {
        "incident_id": "INC-10485",
        "title": "Customer Portal SSO Authentication Failures",
        "description": (
            "Users unable to log in to customer portal via SSO. SAML assertion validation "
            "failing with signature mismatch. Affects all federated identity provider logins. "
            "Local username/password accounts unaffected."
        ),
        "application": "Customer Management",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.AUTHENTICATION,
        "status": IncidentStatus.IN_PROGRESS,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(1, 14, 0),
    },
    {
        "incident_id": "INC-10480",
        "title": "Meter Data Platform - Smart Meter Reading Ingestion Lag",
        "description": (
            "Smart meter reading ingestion pipeline showing 4-hour lag behind real-time. "
            "Kafka consumer group lag increasing steadily. 2.1M messages backlogged. "
            "Downstream billing calculations will be affected if not resolved within 6 hours."
        ),
        "application": "Meter Data Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.INTEGRATION,
        "status": IncidentStatus.OPEN,
        "assigned_to": None,
        "created_at": dt(0, 18, 45),
    },
    {
        "incident_id": "INC-10477",
        "title": "API Gateway Rate Limit Misconfiguration - Third Party Partners",
        "description": (
            "API Gateway applying incorrect rate limits to Tier-1 partner API keys after "
            "yesterday's configuration deployment. Partners reporting HTTP 429 errors on "
            "valid traffic within contracted limits. Affects 8 enterprise integration partners."
        ),
        "application": "API Gateway",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.API,
        "status": IncidentStatus.IN_PROGRESS,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(1, 9, 15),
    },
    {
        "incident_id": "INC-10471",
        "title": "Notification Service - Email Delivery Queue Backlog",
        "description": (
            "Email notification delivery queue has grown to 450,000 undelivered messages. "
            "SMTP relay connection pool exhausted. Password reset and billing notification "
            "emails delayed by up to 3 hours. SMS fallback functioning normally."
        ),
        "application": "Notification Service",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.APPLICATION,
        "status": IncidentStatus.IN_PROGRESS,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(2, 11, 0),
    },
    {
        "incident_id": "INC-10465",
        "title": "Customer Management DB Connection Pool Saturation",
        "description": (
            "PostgreSQL connection pool on customer-db-01 at 98% utilisation during peak hours. "
            "Intermittent timeout errors on customer profile API. Connection leak suspected "
            "following Monday's microservice deployment."
        ),
        "application": "Customer Management",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.DATABASE,
        "status": IncidentStatus.OPEN,
        "assigned_to": None,
        "created_at": dt(3, 16, 30),
    },
    {
        "incident_id": "INC-10458",
        "title": "Billing Platform UAT - Batch Reconciliation Test Data Mismatch",
        "description": (
            "UAT billing reconciliation batch producing £47,000 discrepancy between "
            "expected and actual figures. Test data set may be stale. Blocking UAT sign-off "
            "for next production release."
        ),
        "application": "Billing Platform",
        "environment": IncidentEnvironment.UAT,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.BATCH,
        "status": IncidentStatus.OPEN,
        "assigned_to": None,
        "created_at": dt(4, 10, 0),
    },
    {
        "incident_id": "INC-10450",
        "title": "Payment Processing - 3DS Authentication Timeout Spike",
        "description": (
            "3D Secure authentication step timing out for 6% of card transactions. "
            "Timeout threshold set to 5s; p99 latency from 3DS provider currently 4.8s. "
            "Marginal but causing intermittent checkout failures during peak load."
        ),
        "application": "Payment Processing",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.PERFORMANCE,
        "status": IncidentStatus.OPEN,
        "assigned_to": None,
        "created_at": dt(5, 8, 0),
    },

    # ── RESOLVED INCIDENTS (HISTORICAL) ──────────────────────────────────────────
    {
        "incident_id": "INC-10441",
        "title": "API Gateway - TLS Certificate Expiry Causing 503 Errors",
        "description": (
            "Wildcard TLS certificate expired at 00:00 UTC causing all HTTPS traffic to "
            "API Gateway to return 503. Certificate renewed and deployed. Total outage 47 minutes."
        ),
        "application": "API Gateway",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P1,
        "category": IncidentCategory.INFRASTRUCTURE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(8, 0, 5),
    },
    {
        "incident_id": "INC-10429",
        "title": "Meter Data Platform - Oracle Deadlock in Meter Reading Insert",
        "description": (
            "High frequency deadlock errors (ORA-00060) in meter_readings table during "
            "bulk insert from field device collectors. Resolved by adding row-level lock hints "
            "and reducing batch insert size from 10,000 to 1,000 rows."
        ),
        "application": "Meter Data Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.DATABASE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(12, 3, 0),
    },
    {
        "incident_id": "INC-10418",
        "title": "Customer Management - LDAP Directory Sync Failure",
        "description": (
            "Nightly LDAP sync job failing with connection timeout to corporate AD. "
            "User provisioning blocked for 6 hours. Fixed by increasing LDAP connection timeout "
            "from 30s to 120s and adding retry logic."
        ),
        "application": "Customer Management",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.AUTHENTICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(14, 2, 0),
    },
    {
        "incident_id": "INC-10401",
        "title": "Notification Service - SMS Gateway Provider Outage",
        "description": (
            "Primary SMS gateway provider (Twilio) experiencing service disruption. "
            "Automatic failover to secondary provider (Vonage) activated. 2,100 SMS "
            "notifications delayed by average 8 minutes."
        ),
        "application": "Notification Service",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.INTEGRATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(17, 13, 0),
    },
    {
        "incident_id": "INC-10388",
        "title": "Billing Platform - Datafile Export SFTP Transfer Failure",
        "description": (
            "Daily billing datafile export to external audit system failing with SSH key "
            "authentication error. Audit team's public key had changed without notification. "
            "Keys rotated and SFTP transfer resumed."
        ),
        "application": "Billing Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.BATCH,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(20, 6, 0),
    },
    {
        "incident_id": "INC-10374",
        "title": "Payment Processing - Refund Processing Queue Stuck",
        "description": (
            "Refund processing queue blocked by a single malformed refund record causing "
            "repeated processing failures and preventing subsequent refunds. Dead letter queue "
            "routing fixed; 312 pending refunds processed."
        ),
        "application": "Payment Processing",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.APPLICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(23, 9, 0),
    },
    {
        "incident_id": "INC-10361",
        "title": "API Gateway - High Latency on /v2/customers Endpoint",
        "description": (
            "GET /v2/customers endpoint p99 latency spiked to 12s from baseline of 200ms. "
            "Root cause: missing index on customer_segments table following schema migration. "
            "Index added; latency returned to normal within 3 minutes."
        ),
        "application": "API Gateway",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.PERFORMANCE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(26, 11, 0),
    },
    {
        "incident_id": "INC-10349",
        "title": "Meter Data Platform - HES Network Connectivity Loss",
        "description": (
            "Head-End System (HES) lost connectivity to WAN segment serving 45,000 smart meters. "
            "Network switch firmware bug triggered by traffic spike. Switch rebooted and "
            "connectivity restored. Meter data gap of 2 hours will be backfilled."
        ),
        "application": "Meter Data Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P1,
        "category": IncidentCategory.NETWORK,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(30, 3, 0),
    },
    {
        "incident_id": "INC-10332",
        "title": "Customer Management - Password Reset Token Expiry Bug",
        "description": (
            "Password reset tokens expiring after 1 minute instead of 24 hours due to "
            "timezone handling bug introduced in v2.14.0. Hotfix deployed. Affected users "
            "advised to request new password reset."
        ),
        "application": "Customer Management",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.APPLICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(33, 14, 0),
    },
    {
        "incident_id": "INC-10318",
        "title": "Notification Service - Email Template Rendering Failure",
        "description": (
            "Billing notification emails rendering with broken HTML after template engine "
            "upgrade to v3.2. Jinja2 syntax incompatibility in legacy templates. Templates "
            "migrated to new syntax; all pending emails resent."
        ),
        "application": "Notification Service",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.APPLICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(36, 8, 0),
    },
    {
        "incident_id": "INC-10305",
        "title": "Billing Platform TEST - Incorrect VAT Calculation in Test Suite",
        "description": (
            "VAT calculation logic returning incorrect figures in TEST environment "
            "following regulatory rate update. Test data not refreshed. Blocked three "
            "sprint tickets pending correct test baseline."
        ),
        "application": "Billing Platform",
        "environment": IncidentEnvironment.TEST,
        "severity": IncidentSeverity.P4,
        "category": IncidentCategory.APPLICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": None,
        "created_at": dt(38, 10, 0),
    },
    {
        "incident_id": "INC-10291",
        "title": "Payment Processing - PCI DSS Scan False Positive on Port 8443",
        "description": (
            "Quarterly PCI DSS vulnerability scan flagging port 8443 as open on payment-gw-02. "
            "Port is internal health-check only, not externally routable. Firewall rule added "
            "to restrict to internal CIDR and scan remediated."
        ),
        "application": "Payment Processing",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.INFRASTRUCTURE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(40, 9, 0),
    },
    {
        "incident_id": "INC-10278",
        "title": "API Gateway DEV - OAuth Token Validation Errors After Keycloak Upgrade",
        "description": (
            "DEV environment OAuth 2.0 token validation breaking after Keycloak upgrade "
            "from v21 to v23. JWT signing algorithm changed from RS256 to ES256. "
            "API Gateway configuration updated to accept ES256."
        ),
        "application": "API Gateway",
        "environment": IncidentEnvironment.DEV,
        "severity": IncidentSeverity.P4,
        "category": IncidentCategory.AUTHENTICATION,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": None,
        "created_at": dt(42, 14, 0),
    },
    {
        "incident_id": "INC-10265",
        "title": "Meter Data Platform - Prepayment Meter TOP-UP Processing Delay",
        "description": (
            "Prepayment meter top-up credits taking up to 45 minutes to apply instead "
            "of near-real-time. Root cause: message broker partition rebalancing after "
            "broker node addition. Partition assignment stabilised; processing resumed."
        ),
        "application": "Meter Data Platform",
        "environment": IncidentEnvironment.PROD,
        "severity": IncidentSeverity.P2,
        "category": IncidentCategory.BATCH,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(44, 7, 0),
    },
    {
        "incident_id": "INC-10251",
        "title": "Customer Management DR - Failover Test Data Inconsistency",
        "description": (
            "DR failover test revealed 3-hour replication lag between PROD and DR databases. "
            "Streaming replication misconfigured after last DR infrastructure refresh. "
            "Replication lag reduced to under 30 seconds after configuration fix."
        ),
        "application": "Customer Management",
        "environment": IncidentEnvironment.DR,
        "severity": IncidentSeverity.P3,
        "category": IncidentCategory.INFRASTRUCTURE,
        "status": IncidentStatus.RESOLVED,
        "assigned_to": "engineer@copilot.dev",
        "created_at": dt(47, 10, 0),
    },
]


def seed_incidents() -> None:
    db = SessionLocal()
    try:
        created = 0
        for inc in INCIDENTS:
            existing = db.query(Incident).filter(Incident.incident_id == inc["incident_id"]).first()
            if existing:
                print(f"  [skip] {inc['incident_id']} already exists")
                continue
            incident = Incident(
                incident_id=inc["incident_id"],
                title=inc["title"],
                description=inc["description"],
                application=inc["application"],
                environment=inc["environment"],
                severity=inc["severity"],
                category=inc["category"],
                status=inc["status"],
                assigned_to=inc.get("assigned_to"),
                created_at=inc["created_at"],
                updated_at=inc["created_at"],
            )
            db.add(incident)
            created += 1
            print(f"  [+] {inc['incident_id']} — {inc['application']} ({inc['severity'].value}, {inc['status'].value})")
        db.commit()
        print(f"Incidents seeded: {created} created, {len(INCIDENTS) - created} skipped")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding incidents...")
    seed_incidents()
    print("Done.")
