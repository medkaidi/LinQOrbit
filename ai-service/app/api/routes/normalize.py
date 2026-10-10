"""Profile normalization endpoint: JSON snapshot -> pipeline -> NormalizedProfile."""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.agents.profile_normalize import ProfileNormalizeError, normalize_profile
from app.schemas.normalize import NormalizeRequest, NormalizedProfile

logger = logging.getLogger(__name__)

router = APIRouter(tags=["normalize"])

# ProfileNormalizeError.code -> HTTP status the client should see.
ERROR_STATUS = {
    "empty_profile": 422,
    "no_output": 502,
}


@router.post("/profile/normalize", response_model=NormalizedProfile)
async def normalize_profile_endpoint(request: NormalizeRequest) -> NormalizedProfile:
    """Normalize a candidate profile snapshot into the canonical object.

    422 nothing to normalize, 502 the agent produced no valid structure.
    """
    profile = request.profile
    logger.info(
        "Profile normalization requested : experiences=%d, projects=%d, diplomas=%d, skills=%d",
        len(profile.experiences),
        len(profile.projects),
        len(profile.diplomas),
        len(profile.skills),
    )
    try:
        # The LLM call is blocking: run it off the loop.
        result = await run_in_threadpool(
            normalize_profile, profile, request.location, request.context
        )
    except ProfileNormalizeError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        logger.warning("Profile normalization rejected : code=%s, status=%d", exc.code, status)
        raise HTTPException(status_code=status, detail=exc.message) from exc
    logger.info(
        "Profile normalization succeeded : experiences=%d, projects=%d, skills=%d, has_summary=%s",
        len(result.experiences),
        len(result.projects),
        len(result.skills),
        result.summary is not None,
    )
    return result
