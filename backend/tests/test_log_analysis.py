"""Log analysis service unit tests."""
import os
import pytest
from app.services.log_analysis_service import parse_log


LOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'logs', 'billing_batch_10492.log')


def _load_oracle_log() -> str:
    with open(LOG_PATH, encoding='utf-8') as f:
        return f.read()


def test_parse_oracle_log():
    """billing_batch_10492.log is detected as oracle_batch format and has expected entry count."""
    result = parse_log(_load_oracle_log())
    assert result.format == 'oracle_batch'
    assert result.stats is not None
    assert result.stats.parsed_lines > 80   # log has 96 lines
    assert result.stats.total_lines >= 96


def test_extract_ora_error():
    """ORA-01652 is extracted from the oracle log."""
    result = parse_log(_load_oracle_log())
    ora_errors = [e for e in result.errors if e.code == 'ORA-01652']
    assert len(ora_errors) >= 1
    first = ora_errors[0]
    assert 'TEMP' in first.message or '01652' in first.message
    assert first.line_number == 63   # first mention of ORA-01652 in WARN on line 63


def test_build_timeline():
    """Timeline events are in chronological order and include ERROR/WARN entries."""
    result = parse_log(_load_oracle_log())
    assert len(result.timeline) > 0
    # All events should be sorted
    for i in range(len(result.timeline) - 1):
        assert result.timeline[i].timestamp <= result.timeline[i + 1].timestamp
    levels = {e.level for e in result.timeline}
    assert 'ERROR' in levels or 'WARN' in levels


def test_identify_trigger():
    """Trigger event is the ORA-01652 error (first ERROR with a code)."""
    result = parse_log(_load_oracle_log())
    assert result.trigger is not None
    assert result.trigger.code == 'ORA-01652'
    assert result.trigger.entry.level == 'ERROR'


def test_empty_log():
    """Empty input returns a ParsedLog with zero stats and no crash."""
    result = parse_log('')
    assert result.format == 'unknown'
    assert result.errors == []
    assert result.entries == []
    assert result.timeline == []
    assert result.trigger is None
    assert result.stats is not None
    assert result.stats.total_lines == 0


def test_malformed_lines():
    """Malformed lines are skipped/parsed as plain; valid lines still parsed."""
    content = (
        "2026-08-20 02:11:00.012 UTC [INFO ] [CTX] Normal start\n"
        "MALFORMED LINE WITH NO TIMESTAMP OR LEVEL ##@@!!\n"
        "\x00\x01\x02 null bytes line\n"
        "2026-08-20 02:11:01.000 UTC [ERROR] [CTX] ORA-01652: temp segment error\n"
    )
    result = parse_log(content)
    assert result.stats is not None
    assert result.stats.parsed_lines >= 2   # at least the two valid lines
    assert result.stats.error_count >= 1
    ora_errors = [e for e in result.errors if e.code == 'ORA-01652']
    assert len(ora_errors) == 1


def test_no_errors():
    """A clean log with no errors returns empty error list, not an exception."""
    content = (
        "2026-08-20 02:11:00.012 UTC [INFO ] [CTX] Batch started\n"
        "2026-08-20 02:11:01.000 UTC [INFO ] [CTX] Processing complete\n"
        "2026-08-20 02:11:02.000 UTC [INFO ] [CTX] Batch finished successfully\n"
    )
    result = parse_log(content)
    assert result.errors == []
    assert result.trigger is None
    assert result.stats is not None
    assert result.stats.error_count == 0
    assert result.stats.warn_count == 0
