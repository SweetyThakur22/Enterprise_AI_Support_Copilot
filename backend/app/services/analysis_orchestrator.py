"""AI investigation orchestrator — coordinates the full analysis pipeline."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.analysis_result import AnalysisResult, AnalysisStatus, RiskLevel
from app.models.incident import Incident
from app.models.log_file import LogFile
from app.services import audit_service, historical_service, llm_service, rag_service
from app.services.log_analysis_service import parse_log


def run_analysis(
    db: Session,
    incident_id: int,
    analysis_id: int,
    triggered_by: int,
) -> None:
    """Background task: run the full AI investigation pipeline and update the DB record."""
    result_row = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    if not result_row:
        return

    try:
        result_row.status = AnalysisStatus.PROCESSING
        db.commit()

        # ── 1. Fetch incident ──────────────────────────────────────
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident {incident_id} not found")

        incident_dict = {
            "incident_id": incident.incident_id,
            "title": incident.title,
            "description": incident.description,
            "application": incident.application,
            "environment": incident.environment.value,
            "severity": incident.severity.value,
            "category": incident.category.value,
        }

        # ── 2. Fetch logs ──────────────────────────────────────────
        log_files = db.query(LogFile).filter(LogFile.incident_id == incident_id).all()
        combined_log = "\n".join(lf.content for lf in log_files)

        # ── 3. Parse logs ──────────────────────────────────────────
        parsed_log = parse_log(combined_log)

        # ── 4. RAG retrieval ───────────────────────────────────────
        error_codes = [e.code for e in parsed_log.errors]
        query = f"{incident.category.value} {' '.join(error_codes)} {incident.title}"
        kb_chunks = rag_service.retrieve(db, query, k=5)

        # ── 5. Historical search ───────────────────────────────────
        historical = historical_service.find_similar(
            db,
            error_codes=error_codes,
            application=incident.application,
            category=incident.category.value,
            k=3,
        )

        # ── 6. Call LLM ────────────────────────────────────────────
        llm_result, tokens, latency_ms = llm_service.analyze(
            incident=incident_dict,
            parsed_log=parsed_log,
            kb_chunks=kb_chunks,
            historical=historical,
        )

        # ── 7. Map to DB schema and store ─────────────────────────
        risk_map = {
            'LOW': RiskLevel.LOW,
            'MEDIUM': RiskLevel.MEDIUM,
            'HIGH': RiskLevel.HIGH,
            'CRITICAL': RiskLevel.CRITICAL,
        }
        risk_level = risk_map.get(llm_result.risk_level, RiskLevel.MEDIUM)

        evidence_payload = {
            "kb_chunks": [
                {"source": ev.source, "chunk_id": ev.chunk_id, "text": ev.text, "score": ev.score}
                for ev in llm_result.evidence
            ],
            "historical_incidents": [
                {
                    "incident_id": h.incident_id,
                    "title": h.title,
                    "application": h.application,
                    "severity": h.severity,
                    "similarity": h.similarity,
                    "resolution_hint": h.resolution_hint,
                }
                for h in historical
            ],
            "log_stats": {
                "total_lines": parsed_log.stats.total_lines if parsed_log.stats else 0,
                "error_count": parsed_log.stats.error_count if parsed_log.stats else 0,
                "warn_count": parsed_log.stats.warn_count if parsed_log.stats else 0,
                "time_span_seconds": parsed_log.stats.time_span_seconds if parsed_log.stats else None,
            },
            "timeline": [
                {"timestamp": ev.timestamp, "level": ev.level, "message": ev.message}
                for ev in llm_result.timeline
            ],
            "facts": llm_result.facts,
            "assumptions": llm_result.assumptions,
            "escalation_required": llm_result.escalation_required,
            "escalation_reason": llm_result.escalation_reason,
        }

        recommendations_payload = [
            {
                "text": r.text,
                "risk_level": r.risk_level,
                "requires_approval": r.requires_approval,
                "action_type": r.action_type,
            }
            for r in llm_result.recommendations
        ]

        result_row.status = AnalysisStatus.COMPLETED
        result_row.classification = llm_result.classification
        result_row.root_cause = llm_result.root_cause
        result_row.confidence = llm_result.confidence
        result_row.evidence = evidence_payload
        result_row.recommendations = recommendations_payload
        result_row.risk_level = risk_level
        result_row.requires_approval = llm_result.requires_approval
        result_row.llm_model = "claude-sonnet-4-6"
        result_row.token_usage = tokens
        result_row.latency_ms = latency_ms
        db.commit()

        # ── 8. Audit ───────────────────────────────────────────────
        audit_service.log_action(
            db=db,
            action="ANALYSIS_COMPLETED",
            entity_type="analysis_result",
            entity_id=str(analysis_id),
            user_id=triggered_by,
            details={
                "incident_id": incident.incident_id,
                "confidence": llm_result.confidence,
                "risk_level": llm_result.risk_level,
                "tokens": tokens,
                "latency_ms": latency_ms,
            },
        )

    except Exception as exc:
        result_row.status = AnalysisStatus.FAILED
        # Store generic message client-side; full error is in audit log
        result_row.error_message = "Analysis pipeline failed. See audit log for details."
        db.commit()

        audit_service.log_action(
            db=db,
            action="ANALYSIS_FAILED",
            entity_type="analysis_result",
            entity_id=str(analysis_id),
            user_id=triggered_by,
            details={"error": str(exc)},
        )


def trigger_analysis(
    db: Session,
    incident_id: int,
    triggered_by: int,
) -> AnalysisResult:
    """Create a PENDING analysis record and return it. Caller runs pipeline in background."""
    record = AnalysisResult(
        incident_id=incident_id,
        triggered_by=triggered_by,
        status=AnalysisStatus.PENDING,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    audit_service.log_action(
        db=db,
        action="ANALYSIS_TRIGGERED",
        entity_type="incident",
        entity_id=str(incident_id),
        user_id=triggered_by,
        details={"analysis_id": record.id},
    )
    return record
