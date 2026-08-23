"""FastAPI application entry point."""
import re
import structlog
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from app.api.routes import auth, incidents, analysis, approvals, audit
from app.services import incident_service

logger = structlog.get_logger()

# ── Secret masking ─────────────────────────────────────────────────────────────

_SECRET_PATTERNS = [
    re.compile(r'password\s*=\s*\S+', re.IGNORECASE),
    re.compile(r'api[_-]?key\s*[:=]\s*\S+', re.IGNORECASE),
    re.compile(r'token\s*[:=]\s*\S+', re.IGNORECASE),
    re.compile(r'Authorization:\s*Bearer\s+\S+', re.IGNORECASE),
    re.compile(r'"sk-[a-zA-Z0-9-]+"'),
]


def mask_secrets(text: str) -> str:
    for pat in _SECRET_PATTERNS:
        text = pat.sub('[REDACTED]', text)
    return text


# ── App init ───────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Enterprise AI Support Copilot",
    version="0.1.0",
    description="AI-powered enterprise production-support platform",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────

origins = settings.ALLOWED_ORIGINS if settings.ENVIRONMENT == "production" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers middleware ────────────────────────────────────────────────

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT == "production":
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains"
        )
    return response


# ── Global exception handler ───────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error=mask_secrets(str(exc)),
        exc_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please contact support."},
    )


# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(analysis.router, tags=["analysis"])
app.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": app.version}


# ── Dashboard stats ────────────────────────────────────────────────────────────

@app.get("/dashboard/stats", tags=["dashboard"])
def dashboard_stats(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    from app.schemas.incident import IncidentListItem
    raw = incident_service.get_dashboard_stats(db)
    raw["recent_incidents"] = [IncidentListItem.model_validate(i) for i in raw["recent_incidents"]]
    return raw
