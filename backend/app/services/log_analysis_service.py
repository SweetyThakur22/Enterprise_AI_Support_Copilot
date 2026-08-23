"""Log parsing engine — format detection, timeline construction, error extraction."""
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ──────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────

@dataclass
class LogEntry:
    timestamp: Optional[datetime]
    level: str          # INFO, WARN, ERROR, FATAL, UNKNOWN
    message: str
    raw: str
    line_number: int


@dataclass
class ExtractedError:
    code: str           # e.g. ORA-01652, HTTP-500
    message: str
    line_number: int
    entry: LogEntry


@dataclass
class TimelineEvent:
    timestamp: str      # ISO string (or raw text if parse fails)
    level: str
    message: str
    line_number: int


@dataclass
class LogStats:
    total_lines: int
    parsed_lines: int
    error_count: int
    warn_count: int
    info_count: int
    fatal_count: int
    time_span_seconds: Optional[float]
    first_timestamp: Optional[str]
    last_timestamp: Optional[str]


@dataclass
class ParsedLog:
    format: str                         # oracle_batch, syslog, json, apache, plain, unknown
    entries: list[LogEntry] = field(default_factory=list)
    errors: list[ExtractedError] = field(default_factory=list)
    timeline: list[TimelineEvent] = field(default_factory=list)
    trigger: Optional[ExtractedError] = None
    stats: Optional[LogStats] = None


# ──────────────────────────────────────────────
# Regex patterns
# ──────────────────────────────────────────────

# Oracle-style batch log: 2026-08-20 02:11:00.012 UTC [INFO ] [context] message
_ORACLE_BATCH = re.compile(
    r'^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d+)\s+\w+\s+\[(INFO |WARN |ERROR|FATAL)\]\s+\S+\s+(.*)'
)
# Syslog: Aug 20 02:11:00 host process[pid]: message
_SYSLOG = re.compile(
    r'^(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+\S+\s+\S+:\s+(.*)'
)
# JSON structured log: {"timestamp":..., "level":..., "message":...}
_JSON_LOG = re.compile(r'^\s*\{.*"(level|timestamp)"')
# Apache/Nginx combined: IP - - [date] "method path" status size
_APACHE = re.compile(r'^\S+\s+-\s+-\s+\[.+\]\s+"[A-Z]+\s+/.*"\s+\d{3}')
# Plain timestamped: YYYY-MM-DD HH:MM:SS[.ms] LEVEL message
_PLAIN_TS = re.compile(r'^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}')

# Error extractors
_ORA_ERROR = re.compile(r'\b(ORA-\d{5})\b')
_HTTP_ERROR = re.compile(r'\b([45]\d{2})\b')
_TIMEOUT_PATTERNS = re.compile(r'\b(timeout|timed out|connection refused|connection reset)\b', re.IGNORECASE)
_AUTH_FAILURE = re.compile(r'\b(authentication failed|invalid credentials?|unauthorized|access denied)\b', re.IGNORECASE)

# Levels for oracle batch logs
_LEVEL_MAP = {
    'INFO ': 'INFO',
    'WARN ': 'WARN',
    'ERROR': 'ERROR',
    'FATAL': 'FATAL',
}

_SIGNIFICANT_LEVELS = {'WARN', 'ERROR', 'FATAL'}


# ──────────────────────────────────────────────
# Format detection
# ──────────────────────────────────────────────

def _detect_format(lines: list[str]) -> str:
    sample = [l for l in lines[:50] if l.strip()]
    for line in sample:
        if _JSON_LOG.match(line):
            return 'json'
        if _APACHE.match(line):
            return 'apache'
        if _ORACLE_BATCH.match(line):
            return 'oracle_batch'
        if _SYSLOG.match(line):
            return 'syslog'
    for line in sample:
        if _PLAIN_TS.match(line):
            return 'plain'
    return 'unknown'


# ──────────────────────────────────────────────
# Line parsers per format
# ──────────────────────────────────────────────

def _parse_oracle_ts(ts_str: str) -> Optional[datetime]:
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(ts_str.strip(), fmt)
        except ValueError:
            continue
    return None


def _parse_oracle_batch_line(raw: str, lineno: int) -> Optional[LogEntry]:
    m = _ORACLE_BATCH.match(raw)
    if not m:
        return None
    ts = _parse_oracle_ts(m.group(1))
    level = _LEVEL_MAP.get(m.group(2), m.group(2).strip())
    message = m.group(3).strip()
    return LogEntry(timestamp=ts, level=level, message=message, raw=raw, line_number=lineno)


def _parse_plain_line(raw: str, lineno: int) -> LogEntry:
    level = 'INFO'
    for lvl in ('FATAL', 'ERROR', 'WARN', 'DEBUG', 'INFO', 'CRITICAL'):
        if lvl in raw.upper():
            level = lvl if lvl != 'CRITICAL' else 'FATAL'
            break
    ts = None
    m = _PLAIN_TS.match(raw)
    if m:
        ts_str = m.group(0)
        ts = _parse_oracle_ts(ts_str)
    return LogEntry(timestamp=ts, level=level, message=raw.strip(), raw=raw, line_number=lineno)


# ──────────────────────────────────────────────
# Error extraction
# ──────────────────────────────────────────────

def _extract_errors(entries: list[LogEntry]) -> list[ExtractedError]:
    errors: list[ExtractedError] = []
    for entry in entries:
        ora = _ORA_ERROR.search(entry.message)
        if ora:
            errors.append(ExtractedError(
                code=ora.group(1),
                message=entry.message,
                line_number=entry.line_number,
                entry=entry,
            ))
            continue
        if entry.level in ('ERROR', 'FATAL'):
            http = _HTTP_ERROR.search(entry.message)
            if http:
                errors.append(ExtractedError(
                    code=f"HTTP-{http.group(1)}",
                    message=entry.message,
                    line_number=entry.line_number,
                    entry=entry,
                ))
                continue
            to = _TIMEOUT_PATTERNS.search(entry.message)
            if to:
                errors.append(ExtractedError(
                    code='TIMEOUT',
                    message=entry.message,
                    line_number=entry.line_number,
                    entry=entry,
                ))
                continue
            af = _AUTH_FAILURE.search(entry.message)
            if af:
                errors.append(ExtractedError(
                    code='AUTH_FAILURE',
                    message=entry.message,
                    line_number=entry.line_number,
                    entry=entry,
                ))
    return errors


# ──────────────────────────────────────────────
# Timeline
# ──────────────────────────────────────────────

def _build_timeline(entries: list[LogEntry]) -> list[TimelineEvent]:
    events = []
    for entry in entries:
        if entry.level in _SIGNIFICANT_LEVELS or _ORA_ERROR.search(entry.message):
            ts_str = entry.timestamp.isoformat() if entry.timestamp else entry.raw[:30]
            events.append(TimelineEvent(
                timestamp=ts_str,
                level=entry.level,
                message=entry.message,
                line_number=entry.line_number,
            ))
    events.sort(key=lambda e: e.timestamp)
    return events


# ──────────────────────────────────────────────
# Statistics
# ──────────────────────────────────────────────

def _compute_stats(lines: list[str], entries: list[LogEntry]) -> LogStats:
    counts = {'INFO': 0, 'WARN': 0, 'ERROR': 0, 'FATAL': 0}
    for e in entries:
        lvl = e.level if e.level in counts else 'INFO'
        counts[lvl] += 1

    timestamps = [e.timestamp for e in entries if e.timestamp]
    first_ts = timestamps[0].isoformat() if timestamps else None
    last_ts = timestamps[-1].isoformat() if timestamps else None
    span = (timestamps[-1] - timestamps[0]).total_seconds() if len(timestamps) >= 2 else None

    return LogStats(
        total_lines=len(lines),
        parsed_lines=len(entries),
        error_count=counts['ERROR'],
        warn_count=counts['WARN'],
        info_count=counts['INFO'],
        fatal_count=counts['FATAL'],
        time_span_seconds=span,
        first_timestamp=first_ts,
        last_timestamp=last_ts,
    )


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def parse_log(content: str) -> ParsedLog:
    """Parse raw log content and return a structured ParsedLog."""
    if not content or not content.strip():
        return ParsedLog(
            format='unknown',
            stats=LogStats(0, 0, 0, 0, 0, 0, None, None, None),
        )

    lines = content.splitlines()
    fmt = _detect_format(lines)
    entries: list[LogEntry] = []

    for lineno, raw in enumerate(lines, start=1):
        if not raw.strip():
            continue
        entry: Optional[LogEntry] = None
        if fmt == 'oracle_batch':
            entry = _parse_oracle_batch_line(raw, lineno)
        if entry is None:
            entry = _parse_plain_line(raw, lineno)
        entries.append(entry)

    errors = _extract_errors(entries)
    timeline = _build_timeline(entries)
    stats = _compute_stats(lines, entries)

    # Triggering event: first ERROR/FATAL entry with an error code
    trigger = next((e for e in errors if e.entry.level in ('ERROR', 'FATAL')), None)
    if trigger is None and errors:
        trigger = errors[0]

    return ParsedLog(
        format=fmt,
        entries=entries,
        errors=errors,
        timeline=timeline,
        trigger=trigger,
        stats=stats,
    )
