# API Reference — Enterprise AI Support Copilot

Base URL (local): `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs` (Swagger UI)

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Authentication

### POST /auth/login
Authenticate and receive a JWT.

Rate limited: **5 requests per minute per IP**.

**Request:**
```json
{ "email": "engineer@copilot.dev", "password": "Engineer123!" }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "engineer@copilot.dev",
    "full_name": "Support Engineer",
    "role": "SUPPORT_ENGINEER"
  }
}
```

**Response 401:** Invalid credentials.

---

### GET /auth/me
Returns the authenticated user's profile.

**Response 200:**
```json
{
  "id": 2,
  "email": "engineer@copilot.dev",
  "full_name": "Support Engineer",
  "role": "SUPPORT_ENGINEER",
  "is_active": true,
  "created_at": "2026-01-15T10:00:00Z"
}
```

---

### POST /auth/register
Create a new user. **ADMIN only.**

**Request:**
```json
{
  "email": "newuser@copilot.dev",
  "password": "SecurePass123!",
  "full_name": "New User",
  "role": "SUPPORT_ENGINEER"
}
```

**Response 201:** UserResponse (same shape as /auth/me).

---

## Incidents

### GET /incidents
List incidents with filtering and pagination.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `severity` | P1\|P2\|P3\|P4 | Filter by severity |
| `application` | string | Filter by application name |
| `environment` | DEV\|TEST\|UAT\|PROD\|DR | Filter by environment |
| `category` | string | Filter by category |
| `status` | OPEN\|IN_PROGRESS\|RESOLVED\|CLOSED | Filter by status |
| `page` | int (default 1) | Page number |
| `page_size` | int (default 20, max 100) | Items per page |

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "incident_id": "INC-10492",
      "title": "Billing batch job failure - ORA-01652",
      "application": "Billing Platform",
      "environment": "PROD",
      "severity": "P1",
      "category": "DATABASE",
      "status": "OPEN",
      "created_at": "2026-01-15T02:16:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "page_size": 20
}
```

---

### GET /incidents/{incident_id}
Full incident detail.

`incident_id` is the human-readable ID (e.g., `INC-10492`).

**Response 200:**
```json
{
  "id": 1,
  "incident_id": "INC-10492",
  "title": "Billing batch job failure - ORA-01652",
  "description": "...",
  "application": "Billing Platform",
  "environment": "PROD",
  "severity": "P1",
  "category": "DATABASE",
  "status": "OPEN",
  "assigned_to": "dba-team@company.com",
  "created_at": "2026-01-15T02:16:00Z",
  "updated_at": "2026-01-15T02:16:00Z",
  "log_files": [
    {
      "id": 1,
      "filename": "billing_batch_10492.log",
      "file_size": 4096,
      "uploaded_at": "2026-01-15T02:16:00Z"
    }
  ]
}
```

**Response 404:** Incident not found.

---

### GET /incidents/{incident_id}/logs
Raw log file content for an incident.

**Response 200:**
```json
[
  {
    "id": 1,
    "filename": "billing_batch_10492.log",
    "content": "2026-01-15 02:11:00 INFO ...",
    "file_size": 4096,
    "uploaded_at": "2026-01-15T02:16:00Z"
  }
]
```

---

### GET /incidents/{incident_id}/analysis
Latest analysis result for an incident.

**Response 200:** See Analysis result schema below.

**Response 404:** No analysis exists yet.

---

## Analysis

### POST /incidents/{incident_id}/analyze
Trigger AI analysis. **SUPPORT_ENGINEER, INCIDENT_MANAGER, or ADMIN only.**

Rate limited: **10 requests per hour per user**.

Returns immediately; analysis runs as a background task.

**Response 202:**
```json
{
  "job_id": "42",
  "status": "processing",
  "message": "Analysis started for INC-10492"
}
```

Poll `GET /incidents/{id}/analysis` until `status` is `COMPLETED` or `FAILED`.

---

### GET /incidents/{incident_id}/analysis
Retrieve the latest analysis result.

**Response 200 (COMPLETED):**
```json
{
  "id": 42,
  "incident_id": 1,
  "status": "COMPLETED",
  "classification": "Database Resource Exhaustion",
  "root_cause": "Oracle TEMP tablespace exhausted during large batch sort operation...",
  "confidence": 91,
  "risk_level": "HIGH",
  "requires_approval": true,
  "evidence": {
    "kb_chunks": [
      {
        "chunk_id": 7,
        "document_title": "Oracle Database Troubleshooting Guide",
        "content": "ORA-01652: unable to extend temp segment...",
        "similarity_score": 0.87
      }
    ],
    "historical_incidents": [
      {
        "incident_id": "INC-9821",
        "title": "Oracle TEMP exhaustion - Billing",
        "similarity_score": 0.85,
        "root_cause": "TEMP tablespace exhausted",
        "resolution": "DBA extended TEMP tablespace from 8GB to 16GB"
      }
    ],
    "log_stats": {
      "total_lines": 89,
      "error_count": 3,
      "warn_count": 8,
      "time_span_seconds": 303
    },
    "timeline": [
      {
        "timestamp": "2026-01-15T02:11:00",
        "level": "INFO",
        "message": "Starting monthly invoice generation batch"
      },
      {
        "timestamp": "2026-01-15T02:15:03",
        "level": "ERROR",
        "message": "ORA-01652: unable to extend temp segment by 128 in tablespace TEMP"
      }
    ],
    "facts": ["ORA-01652 error at 02:15:03", "TEMP usage reached 99% at 02:14:47"],
    "assumptions": ["Monthly invoice batch is larger than typical"],
    "escalation_required": false,
    "escalation_reason": null
  },
  "recommendations": [
    {
      "action": "Extend TEMP tablespace from 8GB to 16GB",
      "risk_level": "HIGH",
      "requires_approval": true,
      "rationale": "Immediate relief; similar to INC-9821 resolution"
    }
  ],
  "llm_model": "claude-sonnet-4-6",
  "latency_ms": 4200,
  "created_at": "2026-01-15T09:05:00Z"
}
```

**Response 200 (PENDING/PROCESSING):**
```json
{ "id": 42, "status": "PENDING", "incident_id": 1, "created_at": "..." }
```

**Response 200 (FAILED):**
```json
{ "id": 42, "status": "FAILED", "error_message": "LLM API error", "incident_id": 1, "created_at": "..." }
```

---

### GET /analysis/{analysis_id}/evidence
Full evidence detail for a specific analysis. Returns the `evidence` JSONB field.

---

## Approvals

### GET /approvals
List approval requests. **INCIDENT_MANAGER or ADMIN only.**

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | PENDING\|APPROVED\|REJECTED | Filter by status (default: PENDING) |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "analysis_id": 42,
      "incident_id": "INC-10492",
      "recommendation_text": "Extend TEMP tablespace from 8GB to 16GB",
      "risk_level": "HIGH",
      "status": "PENDING",
      "requested_by": "engineer@copilot.dev",
      "requested_at": "2026-01-15T09:05:10Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

### GET /approvals/{approval_id}
Full approval detail.

**Response 200:** ApprovalDetail — includes `simulated_result` and `review_comment` after decision.

---

### POST /approvals/{approval_id}/approve
Approve a recommendation. **INCIDENT_MANAGER or ADMIN only.**

**Request:**
```json
{ "comment": "Approved — DBA team notified." }
```

**Response 200:**
```json
{
  "id": 1,
  "status": "APPROVED",
  "review_comment": "Approved — DBA team notified.",
  "simulated_result": "Simulation: TEMP tablespace extension request submitted to DBA queue.",
  "reviewed_at": "2026-01-15T09:10:00Z"
}
```

---

### POST /approvals/{approval_id}/reject
Reject a recommendation. Comment is required. **INCIDENT_MANAGER or ADMIN only.**

**Request:**
```json
{ "comment": "Insufficient justification. Please reassess impact." }
```

**Response 200:** Same shape as approve response, `status: "REJECTED"`, no `simulated_result`.

**Response 422:** Comment is empty or missing.

---

## Audit Log

### GET /audit
List audit log entries. **INCIDENT_MANAGER or ADMIN only.**

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Filter by action (e.g., `LOGIN`, `ANALYSIS_TRIGGERED`) |
| `entity_type` | string | Filter by entity type (e.g., `incident`, `approval`) |
| `user_id` | int | Filter by user |
| `from_date` | ISO datetime | Start of date range |
| `to_date` | ISO datetime | End of date range |
| `page` | int | Page number |
| `page_size` | int | Items per page |

**Response 200:**
```json
{
  "items": [
    {
      "id": 100,
      "user_id": 2,
      "user_email": "engineer@copilot.dev",
      "action": "ANALYSIS_TRIGGERED",
      "entity_type": "incident",
      "entity_id": "INC-10492",
      "details": { "analysis_id": 42 },
      "ip_address": "192.168.1.10",
      "created_at": "2026-01-15T09:05:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

**Common action values:**
- `LOGIN` — successful authentication
- `ANALYSIS_TRIGGERED` — analysis started for an incident
- `ANALYSIS_COMPLETED` — analysis finished (COMPLETED or FAILED)
- `APPROVAL_CREATED` — approval request created
- `APPROVAL_APPROVED` — recommendation approved
- `APPROVAL_REJECTED` — recommendation rejected

---

## Dashboard

### GET /dashboard/stats
Aggregate statistics for the dashboard. All roles.

**Response 200:**
```json
{
  "total_incidents_week": 12,
  "open_incidents": 8,
  "critical_incidents": 3,
  "analyzed_count": 5,
  "pending_approvals": 2,
  "avg_confidence": 84.2,
  "by_application": [
    { "application": "Billing Platform", "count": 4 },
    { "application": "Payment Processing", "count": 3 }
  ],
  "by_severity": [
    { "severity": "P1", "count": 3 },
    { "severity": "P2", "count": 5 }
  ],
  "by_day": [
    { "date": "2026-01-09", "count": 1 },
    { "date": "2026-01-10", "count": 2 }
  ],
  "recent_incidents": [...]
}
```

---

## Health

### GET /health
Health check (no auth required).

**Response 200:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Error Responses

All errors follow this shape:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Resource not found |
| 422 | Pydantic validation error |
| 429 | Rate limit exceeded |
| 500 | Internal server error (generic message only — no stack trace) |
