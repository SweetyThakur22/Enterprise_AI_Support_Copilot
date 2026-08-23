# Enterprise AI Support Copilot

> AI-powered enterprise production-support platform that helps engineers investigate and resolve incidents using RAG, structured LLM reasoning, and human-in-the-loop approval workflows.

Production incidents are complex. Engineers waste hours manually correlating logs, searching knowledge bases, and writing incident reports. This platform automates that investigation pipeline, delivering a structured root-cause analysis with evidence, confidence scores, and prioritised recommendations — all in under 30 seconds.

---

## Architecture

```
React Frontend (TypeScript + Vite + Tailwind)
        ↓ REST API
FastAPI Backend (Python 3.11)
  ├── Auth Service        — JWT, bcrypt, RBAC (4 roles)
  ├── Incident Service    — filter, paginate, detail
  ├── Log Analysis        — format detection, timeline, ORA/HTTP error extraction
  ├── RAG Service         — sentence-transformers, pgvector cosine search
  ├── Historical Service  — resolved incident matching
  ├── LLM Service         — Claude claude-sonnet-4-6, Pydantic validation, injection defense
  ├── Orchestrator        — full pipeline coordination
  ├── Approval Service    — human-in-the-loop, simulated actions
  └── Audit Service       — tamper-evident record of every action
        ↓
PostgreSQL + pgvector
  ├── users, incidents, log_files
  ├── kb_documents, kb_chunks (embeddings vector(384))
  ├── analysis_results (JSONB evidence)
  ├── approval_requests
  └── audit_logs
```

---

## Features

- **AI Investigation Pipeline** — full incident analysis in <30s using Claude claude-sonnet-4-6
- **RAG** — Oracle, batch, network, auth, API, performance KB documents embedded with sentence-transformers (all-MiniLM-L6-v2, 384 dims, local/free)
- **Log Parsing** — format detection (oracle_batch, syslog, JSON, apache, plain), ORA-XXXXX and HTTP error extraction, chronological timeline
- **Historical Matching** — finds similar resolved incidents by error code + semantic similarity
- **Structured LLM Output** — Pydantic-validated JSON: classification, root cause, confidence (0-100%), facts, assumptions, evidence items, timeline, recommendations
- **Prompt Injection Defense** — log/KB content wrapped in XML boundaries, system prompt explicitly treats all content as data
- **Approval Workflow** — high/critical recommendations require human approval; simulated action execution
- **RBAC** — 4 roles: ADMIN, INCIDENT_MANAGER, SUPPORT_ENGINEER, VIEWER
- **Audit Trail** — every login, analysis trigger, and approval decision is logged
- **Security Headers** — X-Content-Type-Options, X-Frame-Options, CSP, rate limiting on login (5/min)
- **Dashboard** — real-time metrics, charts (recharts), recent incidents, pending approvals

---

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18 + TypeScript + Vite            |
| UI           | Tailwind CSS + shadcn/ui primitives     |
| State        | TanStack Query v5                       |
| Charts       | Recharts                                |
| Backend      | FastAPI + Python 3.11                   |
| Auth         | JWT + bcrypt + python-jose              |
| Database     | PostgreSQL 15 + pgvector                |
| ORM          | SQLAlchemy 2.0 + Alembic                |
| Embeddings   | sentence-transformers all-MiniLM-L6-v2 (384 dims, local) |
| LLM          | Claude claude-sonnet-4-6 via Anthropic SDK       |
| Validation   | Pydantic v2                             |
| Rate Limiting| slowapi                                 |
| Logging      | structlog                               |
| Testing      | pytest + httpx (50 tests)               |
| Containers   | Docker + Docker Compose                 |
| Deployment   | Railway                                 |
| CI/CD        | GitHub Actions                          |

---

## Quick Start (Docker)

```bash
git clone <repo-url> && cd enterprise-ai-copilot
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY
docker-compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

After services start, seed the database:

```bash
docker-compose exec api python data/seed_all.py
docker-compose exec api python data/embed_kb.py
```

---

## Manual Setup (No Docker)

**Backend:**

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -e ".[dev]"
cp ../.env.example .env  # edit DATABASE_URL, ANTHROPIC_API_KEY
alembic upgrade head
python data/seed_all.py
python data/embed_kb.py
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local  # set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (console.anthropic.com) |
| `SECRET_KEY` | Yes | JWT signing secret (32+ chars) |
| `ALGORITHM` | No | JWT algorithm (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token TTL (default: 30) |
| `ENVIRONMENT` | No | development / production |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |
| `VITE_API_BASE_URL` | Yes (frontend) | Backend API URL |

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@copilot.dev | Admin123! |
| Support Engineer | engineer@copilot.dev | Engineer123! |
| Incident Manager | manager@copilot.dev | Manager123! |
| Viewer | viewer@copilot.dev | Viewer123! |

---

## Demo Walkthrough (INC-10492)

1. Log in as `engineer@copilot.dev`
2. Navigate to **Incidents** → filter by P1 severity
3. Click **INC-10492** — Billing Platform PROD, ORA-01652
4. Click **Analyze Incident**
5. Watch the 6-step progress panel (classifying → parsing logs → RAG → history → analyzing → complete)
6. View results:
   - Classification: Database Resource Exhaustion
   - Root cause: TEMP tablespace exhaustion during invoice generation
   - Confidence: ~91%
   - Evidence panel: Oracle DB Troubleshooting Guide chunks (cosine similarity)
   - Timeline: TEMP warnings at 96% and 99%, ORA-01652 at 02:15:03
   - Historical match: INC-9821 (similar Oracle TEMP issue, resolved by DBA)
   - Recommendation: Extend TEMP tablespace (HIGH risk, requires approval)
7. Log in as `manager@copilot.dev` → navigate to **Approvals**
8. Approve the TEMP extension recommendation → see simulated DBA action
9. Navigate to **Audit Log** → all 3 actions logged with timestamps

---

## AI Architecture

The investigation pipeline runs as a FastAPI `BackgroundTask`:

```
fetch_incident()
    → fetch_log_files()
    → parse_log()           # format detection, ORA errors, timeline
    → retrieve_kb_chunks()  # embed query → pgvector cosine search
    → find_similar()        # error code match + application/category scoring
    → build_prompt()        # XML-bounded evidence, injection defense in system prompt
    → call_claude()         # claude-sonnet-4-6, 2048 max tokens
    → validate_response()   # Pydantic schema, confidence 0-100, evidence grounding
    → store_result()        # JSONB in PostgreSQL
    → create_audit()        # immutable audit record
```

**Prompt injection defense:** Log content, KB excerpts, and descriptions are wrapped in XML tags (`<log_timeline>`, `<kb_content>`, `<incident>`) and the system prompt explicitly instructs the model that all content within these tags is DATA to be analyzed, not instructions to follow.

**Evidence grounding:** Evidence items referencing chunk IDs not in the retrieved set are filtered out before Pydantic validation — preventing the LLM from hallucinating sources.

---

## Security Features

- JWT with configurable expiry, stored in `localStorage`, cleared on logout
- bcrypt password hashing (direct bcrypt library, no passlib)
- RBAC enforced via FastAPI dependencies on every route
- Rate limiting: login 5/minute per IP (slowapi)
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`
- Global exception handler returns generic errors — no stack traces to clients
- Secret masking in structured logs (passwords, API keys, tokens)
- Prompt injection defense with XML content boundaries
- Non-root Docker user in production images

---

## Project Structure

```
enterprise-ai-copilot/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # auth, incidents, analysis, approvals, audit
│   │   ├── core/             # config, database, security, dependencies, limiter
│   │   ├── models/           # SQLAlchemy 2.0 models
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   └── services/         # business logic (no DB queries in routes)
│   ├── data/                 # seed scripts + logs
│   └── tests/                # 50 pytest tests
├── frontend/
│   └── src/
│       ├── pages/            # Dashboard, Incidents, IncidentDetail, Approvals, AuditLog, Login
│       ├── hooks/            # useAuth, useAnalysis
│       ├── services/         # api.ts (axios + JWT interceptor)
│       └── types/            # TypeScript interfaces
├── docker-compose.yml        # local dev
├── docker-compose.prod.yml   # production
├── railway.toml              # Railway deployment
└── .github/workflows/ci.yml  # GitHub Actions CI/CD
```

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
python -m pytest tests/ --cov=app
```

All tests use SQLite — no Docker or real API keys required.

---

## API Documentation

Interactive API docs available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the backend is running.

---

## License

MIT
