import logging
import time
import uuid

from fastapi import FastAPI, Request, Response

from app.api.routes import cv, health, normalize
from app.core.config import settings
from app.core.logging import configure_logging, reset_correlation_id, set_correlation_id

configure_logging(settings.log_level)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LinQOrbit AI Service",
    description="AI service for LinQOrbit: normalization, matching and LLM analysis.",
    version=settings.version,
)

app.include_router(health.router)
app.include_router(cv.router)
app.include_router(normalize.router)


def _response_level(status_code: int) -> int:
    """Log level for a finished request: same thresholds as the backend."""
    if status_code >= 500:
        return logging.ERROR
    if status_code >= 400:
        return logging.WARNING
    return logging.INFO


@app.middleware("http")
async def request_logging(request: Request, call_next) -> Response:
    """Read/emit ``X-Request-Id`` and log every request in and out.

    Never logs the body, the query string or any header other than the
    correlation id — file contents and credentials stay out of the logs.
    """
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    token = set_correlation_id(request_id)
    started = time.perf_counter()
    method, path = request.method, request.url.path
    logger.info("HTTP %s %s", method, path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.exception("HTTP %s %s failed : %.0f ms", method, path, elapsed_ms)
        reset_correlation_id(token)
        raise
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.log(
        _response_level(response.status_code),
        "HTTP %s %s -> %d : %.0f ms",
        method,
        path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["X-Request-Id"] = request_id
    reset_correlation_id(token)
    return response
