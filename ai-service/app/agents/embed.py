"""Text embedding: texts -> one unit-length vector per text.

No agent loop (there is nothing to decide): the module wraps the embedding
model, checks what comes back and turns provider failures into
``EmbedError`` so the route never leaks a raw SDK error (TD-056).
"""

from __future__ import annotations

import logging
import math

from app.core.config import settings
from app.llm.client import get_embeddings

logger = logging.getLogger(__name__)

# Below this deviation a vector is considered unit-length already.
NORM_TOLERANCE = 1e-3
# Provider markers of an exhausted quota (HTTP 429 / gRPC RESOURCE_EXHAUSTED).
QUOTA_MARKERS = ("429", "RESOURCE_EXHAUSTED", "quota")


class EmbedError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _normalized(vector: list[float]) -> list[float]:
    """L2-normalize: truncated (MRL) vectors are not unit-length on every model."""
    if not all(math.isfinite(value) for value in vector):
        raise EmbedError("no_output", "The embedding model returned a non-finite value.")
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        raise EmbedError("no_output", "The embedding model returned a null vector.")
    if abs(norm - 1.0) <= NORM_TOLERANCE:
        return vector
    return [value / norm for value in vector]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed ``texts`` in order; every vector has ``settings.embedding_dimensions`` values."""
    try:
        vectors = get_embeddings().embed_documents(texts)
    except Exception as exc:  # provider/SDK failures vary: classify, never leak
        message = str(exc)
        if any(marker.lower() in message.lower() for marker in QUOTA_MARKERS):
            logger.warning("Embedding quota exhausted : texts=%d", len(texts))
            raise EmbedError("rate_limited", "The embedding service is rate limited, retry later.") from exc
        logger.warning("Embedding provider failure : type=%s", type(exc).__name__)
        raise EmbedError("provider_error", "The embedding service is unavailable.") from exc

    if len(vectors) != len(texts):
        raise EmbedError("no_output", "The embedding model returned an unexpected number of vectors.")
    expected = settings.embedding_dimensions
    if any(len(vector) != expected for vector in vectors):
        logger.warning("Embedding dimension mismatch : expected=%d", expected)
        raise EmbedError("no_output", f"The embedding model did not return {expected} dimensions.")
    return [_normalized(vector) for vector in vectors]
