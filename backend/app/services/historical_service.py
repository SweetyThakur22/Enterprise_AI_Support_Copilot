"""Historical incident search — find similar resolved incidents."""
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.incident import Incident, IncidentStatus


@dataclass
class HistoricalMatch:
    incident_id: str
    title: str
    application: str
    severity: str
    resolved_at: Optional[str]
    root_cause_hint: str
    resolution_hint: str
    similarity: float


def find_similar(
    db: Session,
    error_codes: list[str],
    application: str,
    category: str,
    k: int = 3,
) -> list[HistoricalMatch]:
    """Find resolved incidents similar to the given error codes + context.

    Similarity is scored using exact error-code matches and application/category
    matching — no fabricated similarity scores.
    """
    resolved = (
        db.query(Incident)
        .filter(Incident.status == IncidentStatus.RESOLVED)
        .all()
    )

    scored: list[tuple[float, Incident]] = []
    for inc in resolved:
        score = 0.0
        desc_lower = (inc.description or '').lower()
        title_lower = (inc.title or '').lower()

        for code in error_codes:
            code_lower = code.lower()
            if code_lower in desc_lower or code_lower in title_lower:
                score += 0.6

        if inc.application == application:
            score += 0.25
        if inc.category and inc.category.value == category:
            score += 0.15

        if score > 0:
            scored.append((min(score, 1.0), inc))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:k]

    results: list[HistoricalMatch] = []
    for sim, inc in top:
        results.append(HistoricalMatch(
            incident_id=inc.incident_id,
            title=inc.title,
            application=inc.application,
            severity=inc.severity.value,
            resolved_at=inc.updated_at.isoformat() if inc.updated_at else None,
            root_cause_hint=f"See description of {inc.incident_id}: {(inc.description or '')[:200]}",
            resolution_hint="Consult the resolution notes for this incident in your ticketing system.",
            similarity=round(sim, 4),
        ))
    return results
