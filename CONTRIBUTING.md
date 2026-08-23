# Contributing

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker + Docker Compose (for local Postgres)
- An Anthropic API key

## Local Setup

```bash
git clone <repo-url> && cd enterprise-ai-copilot
cp .env.example .env
# Fill in DATABASE_URL, ANTHROPIC_API_KEY, SECRET_KEY
docker-compose up postgres -d   # start Postgres only
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
# python -m venv .venv && source .venv/bin/activate  # Mac/Linux
pip install -e ".[dev]"
alembic upgrade head
python data/seed_all.py
python data/embed_kb.py
uvicorn app.main:app --reload
```

In a second terminal:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

Tests use SQLite — no running Postgres or API keys required.

## Code Style

- Python: follow existing patterns (SQLAlchemy 2.0, Pydantic v2, FastAPI dependencies)
- TypeScript: strict mode, no `any`
- No print() statements — use structlog in backend, console.error sparingly in frontend
- No comments explaining what code does — names should do that; comments only for non-obvious why

## Branching

- Branch from `main`
- PR title: `<type>: <short description>` (e.g., `fix: correct confidence bounds validation`)
- All tests must pass before merging

## Security Notes

- Never commit `.env` or any file containing real API keys
- Never add stack traces to API responses
- Never fabricate evidence in LLM responses — always ground to retrieved chunk IDs
- Rate limiting is enforced on auth and analysis endpoints — tests reset the limiter in `conftest.py`

## Reporting Issues

Open a GitHub issue with: steps to reproduce, expected vs actual behaviour, and Python/Node versions.
