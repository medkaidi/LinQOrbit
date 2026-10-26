"""Text embedding: texts -> one unit-length vector per text.

No agent loop (there is nothing to decide): the module wraps the embedding
model, checks what comes back and turns provider failures into
``EmbedError`` so the route never leaks a raw SDK error (TD-056).
"""

from __future__ import annotations

import logging
import math
from collections.abc import Sequence
from numbers import Real

from app.core.config import settings
from app.llm.client import get_embeddings

logger = logging.getLogger(__name__)

# Below this deviation a vector is considered unit-length already.
NORM_TOLERANCE = 1e-3
# A real embedding component is of the order of 1: beyond this the provider output is not trusted.
MAX_COMPONENT = 1e6
# After normalization the norm must be 1 to double precision (rounding is ~1e-15): anything else is degenerate.
UNIT_TOLERANCE = 1e-9
# Provider markers of an exhausted quota (HTTP 429 / gRPC RESOURCE_EXHAUSTED).
QUOTA_MARKERS = ("429", "RESOURCE_EXHAUSTED", "quota")


class EmbedError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _is_sequence(value: object) -> bool:
    """A list/tuple-like container; a string is a sequence of characters, never a vector."""
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


def _is_number(value: object) -> bool:
    return isinstance(value, Real) and not isinstance(value, bool)


def _invalid_output() -> EmbedError:
    return EmbedError("no_output", "The embedding model returned an invalid output.")


def _checked(vectors: object, count: int) -> list[list[float]]:
    """Structure of the provider output: a sequence of ``count`` sequences of numbers.

    Everything the model/SDK can hand back is untrusted: a wrong shape becomes
    ``EmbedError("no_output")`` (HTTP 502), never a raw ``TypeError`` (HTTP 500).
    """
    if not _is_sequence(vectors):
        raise _invalid_output()
    if len(vectors) != count:
        raise EmbedError("no_output", "The embedding model returned an unexpected number of vectors.")
    if not all(_is_sequence(vector) for vector in vectors):
        raise _invalid_output()
    expected = settings.embedding_dimensions
    if any(len(vector) != expected for vector in vectors):
        logger.warning("Embedding dimension mismatch : expected=%d", expected)
        raise EmbedError("no_output", f"The embedding model did not return {expected} dimensions.")
    if not all(_is_number(value) for vector in vectors for value in vector):
        raise _invalid_output()
    try:
        return [[float(value) for value in vector] for vector in vectors]
    except OverflowError as exc:  # an int too large for a float is not a usable component
        raise _invalid_output() from exc


def _normalized(vector: list[float]) -> list[float]:
    """L2-normalize: truncated (MRL) vectors are not unit-length on every model.

    A component of implausible magnitude means a broken provider: invalid output. The norm is computed
    with ``math.hypot`` (no overflow, no underflow) and the result is checked: a vector that does not
    come out finite and unit-length is an invalid output (HTTP 502), never a degenerate vector delivered
    as a 200 (D80).
    """
    if not all(math.isfinite(value) for value in vector):
        raise EmbedError("no_output", "The embedding model returned a non-finite value.")
    if any(abs(value) > MAX_COMPONENT for value in vector):
        raise EmbedError("no_output", "The embedding model returned an implausibly large value.")
    norm = math.hypot(*vector)
    if norm == 0:
        raise EmbedError("no_output", "The embedding model returned a null vector.")
    if abs(norm - 1.0) <= NORM_TOLERANCE:
        return vector
    normalized = [value / norm for value in vector]
    if not all(math.isfinite(value) for value in normalized) or abs(math.hypot(*normalized) - 1.0) > UNIT_TOLERANCE:
        raise EmbedError("no_output", "The embedding model returned a vector that cannot be normalized.")
    return normalized


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

    return [_normalized(vector) for vector in _checked(vectors, len(texts))]
