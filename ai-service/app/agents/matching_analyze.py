"""Matching pipeline (D58): full context -> agent -> per-criterion scores.

Mirrors ``job_offer_normalize``: one agent run, then at most one repair turn.
On top of the schema, the pipeline checks the coverage of the criteria: one
assessment per requested key, no missing and no extra key. A wrong coverage
gets the repair turn with the exact keys to fix; the backend checks the
coverage again on its side (never trust a single guard).
"""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.graphs.matching_agent import build_matching_agent
from app.graphs.matching_policy import POLICY_VERSION
from app.schemas.matching import SCHEMA_VERSION, MatchingAnalysis, MatchingAnalyzeRequest

logger = logging.getLogger(__name__)

# Same backstop as the normalization pipelines: ModelCallLimitMiddleware ends
# the run first with structured_response=None, which gives the repair turn
# its chance.
RECURSION_LIMIT = 32

RUN_NAME = "matching-analyze"

NO_OUTPUT_MESSAGE = "The agent could not score every criterion of this matching."


class MatchingAnalyzeError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def coverage_gaps(analysis: MatchingAnalysis, request: MatchingAnalyzeRequest) -> tuple[list[str], list[str]]:
    """Keys missing from the analysis, and keys the request never asked for."""
    expected = [criterion.key for criterion in request.criteria]
    returned = {assessment.criterion_key for assessment in analysis.assessments}
    missing = [key for key in expected if key not in returned]
    unexpected = sorted(returned - set(expected))
    return missing, unexpected


def _repair_message(missing: list[str], unexpected: list[str]) -> str:
    """Instruction of the repair turn: the exact keys to fix, or the bare schema reminder."""
    if not missing and not unexpected:
        return "You finished without the structured output. Submit it now, strictly following the schema."
    parts = ["Your answer does not cover the criteria exactly. Submit the full answer again."]
    if missing:
        parts.append("Missing criterion keys: " + ", ".join(missing) + ".")
    if unexpected:
        parts.append("Keys that are not criteria of this request (remove them): " + ", ".join(unexpected) + ".")
    return " ".join(parts)


def _finalize(analysis: MatchingAnalysis) -> MatchingAnalysis:
    analysis.schema_version = SCHEMA_VERSION
    analysis.policy_version = POLICY_VERSION
    return analysis


def analyze_matching(request: MatchingAnalyzeRequest) -> MatchingAnalysis:
    """Score the candidate sheet against every criterion of the offer sheet."""
    if not request.criteria:
        raise MatchingAnalyzeError("empty_criteria", "The matching has no criterion to score.")

    payload = {
        "criteria": [criterion.model_dump(by_alias=True, exclude_none=True) for criterion in request.criteria],
        "offer": request.offer,
        "candidate": request.candidate,
    }
    agent = build_matching_agent()
    # The matching id tags the LangSmith run as a thread: the traces of one
    # matching (analysis, then clarifications) group together. Nothing is
    # stored here — the backend replays the whole context on every call.
    config = {
        "recursion_limit": RECURSION_LIMIT,
        "run_name": RUN_NAME,
        "metadata": {"thread_id": request.matching_id},
    }
    messages = [
        HumanMessage(
            content="Score the candidate sheet against each criterion of the offer:\n\n"
            + json.dumps(payload, ensure_ascii=False)
        )
    ]
    try:
        result = agent.invoke({"messages": messages}, config=config)
    except GraphRecursionError as exc:
        raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE) from exc

    parsed = result.get("structured_response")
    missing: list[str] = []
    unexpected: list[str] = []
    if isinstance(parsed, MatchingAnalysis):
        missing, unexpected = coverage_gaps(parsed, request)
        if not missing and not unexpected:
            return _finalize(parsed)
        logger.warning(
            "Matching analysis : coverage mismatch, running repair turn : missing=%d, unexpected=%d",
            len(missing),
            len(unexpected),
        )
    else:
        logger.warning("Matching analysis : structured output missing, running repair turn")

    # One repair turn, replaying this run's history explicitly (no checkpointer).
    try:
        repair = agent.invoke(
            {"messages": [*result["messages"], HumanMessage(content=_repair_message(missing, unexpected))]},
            config=config,
        )
    except GraphRecursionError as exc:
        raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, MatchingAnalysis) and coverage_gaps(parsed, request) == ([], []):
        logger.info("Matching analysis : repair turn recovered the structured output")
        return _finalize(parsed)

    raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE)
