"""Matching endpoint (D58): full context -> pipeline -> per-criterion scores."""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.agents.matching_analyze import MatchingAnalyzeError, analyze_matching
from app.schemas.matching import MatchingAnalysis, MatchingAnalyzeRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["matching"])

# MatchingAnalyzeError.code -> HTTP status the client should see.
ERROR_STATUS = {
    "empty_criteria": 422,
    "no_output": 502,
}


@router.post("/matching/analyze", response_model=MatchingAnalysis)
async def analyze_matching_endpoint(request: MatchingAnalyzeRequest) -> MatchingAnalysis:
    """Score a candidate sheet against the criteria of an offer sheet.

    422 nothing to score, 502 the agent produced no valid scoring.
    """
    logger.info("Matching analysis requested : criteria=%d", len(request.criteria))
    try:
        # The LLM call is blocking: run it off the loop.
        result = await run_in_threadpool(analyze_matching, request)
    except MatchingAnalyzeError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        logger.warning("Matching analysis rejected : code=%s, status=%d", exc.code, status)
        raise HTTPException(status_code=status, detail=exc.message) from exc
    logger.info(
        "Matching analysis succeeded : assessments=%d, policy=%s",
        len(result.assessments),
        result.policy_version,
    )
    return result
