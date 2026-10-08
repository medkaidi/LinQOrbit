"""Logging setup: one console format for the whole service.

Mirrors the backend's logging policy (see ``backend/AGENTS.md`` § Logging):
same line shape (date, level, correlation id, logger, message), level set
from configuration, and a per-request correlation id carried like a MDC key.
"""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar, Token

# Same shape as the backend's pattern:
# "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%X{correlationId:-}] %logger{40} - %msg%n"
FORMAT = "%(asctime)s.%(msecs)03d %(levelname)-5s [%(correlationId)s] %(name)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")


def set_correlation_id(value: str) -> Token[str]:
    """Bind the correlation id for the current task (returns the reset token)."""
    return _correlation_id.set(value)


def reset_correlation_id(token: Token[str]) -> None:
    """Restore the previous correlation id."""
    _correlation_id.reset(token)


class CorrelationFilter(logging.Filter):
    """Stamp every record with the current request id (default ``-``)."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlationId = _correlation_id.get()
        return True


def configure_logging(level: str = "INFO") -> None:
    """Install the console format on the root logger.

    Idempotent: when the host (pytest) already installed handlers,
    ``basicConfig`` is a no-op and nothing is reconfigured.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FORMAT, datefmt=DATE_FORMAT))
    handler.addFilter(CorrelationFilter())
    logging.basicConfig(level=level.upper(), handlers=[handler])
