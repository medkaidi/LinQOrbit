"""Job offer normalization endpoint: JSON snapshot -> pipeline -> NormalizedJobOffer."""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.agents.job_offer_normalize import JobOfferNormalizeError, normalize_job_offer
from app.schemas.job_offer import JobOfferNormalizeRequest, NormalizedJobOffer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["normalize"])

# JobOfferNormalizeError.code -> HTTP status the client should see.
ERROR_STATUS = {
    "empty_offer": 422,
    "no_output": 502,
}


@router.post("/job-offer/normalize", response_model=NormalizedJobOffer)
async def normalize_job_offer_endpoint(request: JobOfferNormalizeRequest) -> NormalizedJobOffer:
    """Normalize a job offer snapshot into the canonical object.

    422 nothing to normalize, 502 the agent produced no valid structure.
    """
    offer = request.offer
    logger.info(
        "Job offer normalization requested : has_title=%s, skills=%d, languages=%d",
        offer.title is not None,
        len(offer.skills),
        len(offer.languages),
    )
    try:
        # The LLM call is blocking: run it off the loop.
        result = await run_in_threadpool(normalize_job_offer, offer, request.context)
    except JobOfferNormalizeError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        logger.warning("Job offer normalization rejected : code=%s, status=%d", exc.code, status)
        raise HTTPException(status_code=status, detail=exc.message) from exc
    logger.info(
        "Job offer normalization succeeded : required=%d, preferred=%d, responsibilities=%d",
        len(result.required_skills),
        len(result.preferred_skills),
        len(result.responsibilities),
    )
    return result
