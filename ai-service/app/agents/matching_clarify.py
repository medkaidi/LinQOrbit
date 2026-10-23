"""Clarification pipeline (T-62): full context -> agent -> next question or none.

Mirrors ``matching_analyze``: one agent run, then at most one repair turn when
the structured output is missing. The question budget is enforced here, not
left to the model: with no question remaining the agent is never called.
"""

from __future__ import annotations

import json
import logging

from langchain.agents.structured_output import StructuredOutputError
from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.graphs.matching_clarify_agent import build_matching_clarify_agent
from app.schemas.matching import ClarificationSuggestion, MatchingClarifyRequest

logger = logging.getLogger(__name__)

# Same backstop as the other pipelines: ModelCallLimitMiddleware ends the run
# first with structured_response=None, which gives the repair turn its chance.
RECURSION_LIMIT = 32

RUN_NAME = "matching-clarify"

NO_OUTPUT_MESSAGE = "The agent could not suggest a clarification question for this matching."

REPAIR_MESSAGE = (
    "You finished without the structured output. Submit it now, strictly following the schema:"
    " one question with its rationale, or a null question."
)


class MatchingClarifyError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def clarify_matching(request: MatchingClarifyRequest) -> ClarificationSuggestion:
    """Suggest the next clarification question, or none (``question`` null)."""
    if not request.criteria:
        raise MatchingClarifyError("empty_criteria", "The matching has no criterion to clarify.")
    if request.remaining_questions == 0:
        logger.info("Matching clarification : no question left, agent not called")
        return ClarificationSuggestion(question=None)

    payload = {
        "criteria": [criterion.model_dump(by_alias=True, exclude_none=True) for criterion in request.criteria],
        "offer": request.offer,
        "candidate": request.candidate,
        "assessments": [assessment.model_dump(by_alias=True) for assessment in request.assessments],
        "clarifications": [clarification.model_dump(by_alias=True) for clarification in request.clarifications],
        "remainingQuestions": request.remaining_questions,
    }
    agent = build_matching_clarify_agent()
    # Same thread as the analyses of this matching in LangSmith; nothing is
    # stored here — the backend replays the whole context on every call.
    config = {
        "recursion_limit": RECURSION_LIMIT,
        "run_name": RUN_NAME,
        "metadata": {"thread_id": request.matching_id},
    }
    messages = [
        HumanMessage(
            content="Suggest the next clarification question for the candidate, or none:\n\n"
            + json.dumps(payload, ensure_ascii=False)
        )
    ]
    history = messages
    try:
        result = agent.invoke({"messages": messages}, config=config)
    except GraphRecursionError as exc:
        raise MatchingClarifyError("no_output", NO_OUTPUT_MESSAGE) from exc
    except StructuredOutputError as exc:
        # Rejected by the schema: restart from the request, never replay the
        # invalid message. Logs carry the error type only, never the content.
        logger.warning(
            "Matching clarification : structured output rejected, running repair turn : error=%s",
            type(exc).__name__,
        )
        parsed = None
    else:
        parsed = result.get("structured_response")
        if isinstance(parsed, ClarificationSuggestion):
            return parsed
        history = result["messages"]
        logger.warning("Matching clarification : structured output missing, running repair turn")

    # One repair turn, replaying the request/history explicitly (no checkpointer).
    try:
        repair = agent.invoke(
            {"messages": [*history, HumanMessage(content=REPAIR_MESSAGE)]},
            config=config,
        )
    except GraphRecursionError as exc:
        raise MatchingClarifyError("no_output", NO_OUTPUT_MESSAGE) from exc
    except StructuredOutputError as exc:
        logger.warning(
            "Matching clarification : repair output rejected : error=%s",
            type(exc).__name__,
        )
        raise MatchingClarifyError("no_output", NO_OUTPUT_MESSAGE) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, ClarificationSuggestion):
        logger.info("Matching clarification : repair turn recovered the structured output")
        return parsed

    raise MatchingClarifyError("no_output", NO_OUTPUT_MESSAGE)
