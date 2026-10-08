"""Behavioral tests for the request logging policy (levels, correlation, line shape)."""

import logging

from fastapi.testclient import TestClient

from app.core.logging import (
    CorrelationFilter,
    DATE_FORMAT,
    FORMAT,
    reset_correlation_id,
    set_correlation_id,
)
from app.main import app

client = TestClient(app)


def test_health_logs_request_in_and_out_with_request_id(caplog) -> None:
    with caplog.at_level(logging.INFO):
        response = client.get("/health", headers={"X-Request-Id": "req-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-Id"] == "req-123"
    messages = [record.getMessage() for record in caplog.records]
    assert "HTTP GET /health" in messages
    assert any("HTTP GET /health -> 200" in message for message in messages)


def test_client_error_is_logged_at_warning(caplog) -> None:
    with caplog.at_level(logging.INFO):
        response = client.post(
            "/cv/parse",
            files={"file": ("cv.txt", b"not a pdf", "text/plain")},
        )

    assert response.status_code == 415
    warnings = [record for record in caplog.records if record.levelno == logging.WARNING]
    assert any("CV parse rejected : unsupported content type" in record.getMessage() for record in warnings)


def test_correlation_filter_stamps_request_id_and_defaults_to_dash() -> None:
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "msg", None, None)
    token = set_correlation_id("req-42")
    try:
        assert CorrelationFilter().filter(record)
        assert record.correlationId == "req-42"
    finally:
        reset_correlation_id(token)

    fresh = logging.LogRecord("t", logging.INFO, __file__, 1, "msg", None, None)
    assert CorrelationFilter().filter(fresh)
    assert fresh.correlationId == "-"


def test_line_format_contains_level_correlation_and_logger() -> None:
    record = logging.LogRecord("app.test", logging.INFO, "f.py", 1, "hello", None, None)
    record.correlationId = "req-1"

    line = logging.Formatter(FORMAT, datefmt=DATE_FORMAT).format(record)

    assert "INFO" in line
    assert "[req-1] app.test - hello" in line
