"""Contracts for text embedding: what Spring Boot sends in and what comes back.

The service is a thin wrapper around the embedding model: it receives already
rendered text (the representation strategy belongs to the backend, which
versions it) and returns one vector per text, in the same order. It knows
nothing about candidates, offers or normalized profiles.
"""

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

# Bounds protect the provider quota and the request size; the backend sends one
# fiche per call today, the batch cap leaves room for a throttled backfill.
MAX_TEXTS = 32
MAX_TEXT_LENGTH = 32_000

# A blank text has no meaning to embed: rejected at the edge (422), never sent.
EmbedText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEXT_LENGTH)]


class EmbedRequest(BaseModel):
    """Texts to embed, one vector per text in the same order."""

    texts: list[EmbedText] = Field(min_length=1, max_length=MAX_TEXTS)


class EmbedResponse(BaseModel):
    """Vectors in request order; ``dimensions`` is the length of every vector."""

    model: str
    dimensions: int
    embeddings: list[list[float]]
