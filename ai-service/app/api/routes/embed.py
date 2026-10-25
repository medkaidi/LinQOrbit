"""Embedding endpoint: rendered texts -> vectors (screening, SPEC §8.4)."""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.agents.embed import EmbedError, embed_texts
from app.core.config import settings
from app.schemas.embed import EmbedRequest, EmbedResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["embed"])

# EmbedError.code -> HTTP status the client should see. 429 lets the backend
# defer the retry instead of burning its attempts on an exhausted quota.
ERROR_STATUS = {
    "rate_limited": 429,
    "provider_error": 502,
    "no_output": 502,
}


@router.post("/embed", response_model=EmbedResponse)
async def embed_endpoint(request: EmbedRequest) -> EmbedResponse:
    """Embed the given texts, one vector per text in the same order.

    422 invalid payload, 429 provider quota, 502 provider failure or invalid output.
    """
    logger.info("Embedding requested : texts=%d", len(request.texts))
    try:
        # The provider call is blocking: run it off the loop.
        vectors = await run_in_threadpool(embed_texts, request.texts)
    except EmbedError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        logger.warning("Embedding rejected : code=%s, status=%d", exc.code, status)
        raise HTTPException(status_code=status, detail=exc.message) from exc
    logger.info("Embedding succeeded : texts=%d, dimensions=%d", len(vectors), settings.embedding_dimensions)
    return EmbedResponse(
        model=settings.embedding_model,
        dimensions=settings.embedding_dimensions,
        embeddings=vectors,
    )
