"""Matching pipeline (D58): full context -> agent -> per-criterion scores.

Mirrors ``job_offer_normalize``: one agent run, then at most one repair turn.
On top of the schema, the pipeline checks the coverage of the criteria (one
assessment per requested key, no missing and no extra key) and the evidence
indexes: a sheet evidence must point to an existing entry of the candidate
sheet, a ``clarification`` evidence to an existing clarification of the
request that was answered (a skip is never evidence). A gap gets the repair
turn with the exact items to fix; the backend checks the coverage again on
its side (never trust a single guard).

The same single repair turn also covers an output the schema rejects
(``StructuredOutputError``: a Pydantic validation error such as a score above
0 without evidence, or several structured outputs at once). The invalid
message is not replayed: the repair restarts from the request with the exact
errors to fix. Still rejected after the repair -> ``no_output`` (502), never
a 500. Any other exception (provider failure, bug) is not caught here and
stays a 500 (TD-056).

Education is scored IN CODE (D68): the joint ``education:requirement``
criterion carries its structured requirement and ``score_education`` scores
it from the candidate sheet. It is never sent to the model, never repaired;
the agent, its coverage check and its repair turn only see the other
criteria (and their previous assessments). Without any other criterion, no
agent is built at all. The deterministic and model assessments are merged
and their coverage checked against every criterion of the request.
"""

from __future__ import annotations

import json
import logging

from langchain.agents.structured_output import (
    MultipleStructuredOutputsError,
    StructuredOutputError,
    StructuredOutputValidationError,
)
from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError
from pydantic import ValidationError

from app.core.config import settings
from app.graphs.matching_agent import build_matching_agent
from app.graphs.matching_policy import POLICY_VERSION, score_education
from app.graphs.matching_policy import EducationRequirement as EducationRules
from app.schemas.matching import (
    EVIDENCE_ARRAYS,
    SCHEMA_VERSION,
    ClarificationHistory,
    CriterionAssessment,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingCriterion,
    MatchingEvidence,
)

logger = logging.getLogger(__name__)

# Same backstop as the normalization pipelines: ModelCallLimitMiddleware ends
# the run first with structured_response=None, which gives the repair turn
# its chance.
RECURSION_LIMIT = 32

RUN_NAME = "matching-analyze"

NO_OUTPUT_MESSAGE = "The agent could not score every criterion of this matching."

# Wording of the CriterionAssessment validator (app/schemas/matching.py).
EVIDENCE_RULE = "a score above 0 needs at least one evidence"
EVIDENCE_RULE_HINT = (
    "Cite the entry of the related technology (source 'skill' with its 0-based index) or the experience that"
    " proves it. If no such entry exists, use score 0. Never invent evidence."
)


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


def evidence_gaps(analysis: MatchingAnalysis, candidate: dict) -> list[str]:
    """Evidence pointing outside the candidate sheet, as ``key -> source[index]``.

    ``clarification`` evidence points into the request, not the sheet: see
    ``clarification_gaps``.
    """
    gaps: list[str] = []
    for assessment in analysis.assessments:
        for evidence in assessment.evidence:
            if evidence.index is None or evidence.source == "clarification":
                continue
            entries = candidate.get(EVIDENCE_ARRAYS[evidence.source])
            size = len(entries) if isinstance(entries, list) else 0
            if evidence.index >= size:
                gaps.append(f"{assessment.criterion_key} -> {evidence.source}[{evidence.index}]")
    return gaps


def clarification_gaps(analysis: MatchingAnalysis, clarifications: list[ClarificationHistory]) -> list[str]:
    """``clarification`` evidence that is not a usable answer, as ``key -> clarification[index] (reason)``.

    The index must exist in the clarifications of the request, and that
    clarification must have been answered: a skipped question is never
    evidence.
    """
    gaps: list[str] = []
    for assessment in analysis.assessments:
        for evidence in assessment.evidence:
            if evidence.source != "clarification" or evidence.index is None:
                continue
            pointer = f"{assessment.criterion_key} -> clarification[{evidence.index}]"
            if evidence.index >= len(clarifications):
                gaps.append(f"{pointer} (does not exist)")
            elif clarifications[evidence.index].status != "answered":
                gaps.append(f"{pointer} (skipped)")
    return gaps


def _repair_message(
    missing: list[str], unexpected: list[str], bad_evidence: list[str], bad_clarifications: list[str]
) -> str:
    """Instruction of the repair turn: the exact items to fix, or the bare schema reminder."""
    if not missing and not unexpected and not bad_evidence and not bad_clarifications:
        return "You finished without the structured output. Submit it now, strictly following the schema."
    parts = ["Your answer does not cover the criteria exactly. Submit the full answer again."]
    if missing:
        parts.append("Missing criterion keys: " + ", ".join(missing) + ".")
    if unexpected:
        parts.append("Keys that are not criteria of this request (remove them): " + ", ".join(unexpected) + ".")
    if bad_evidence:
        parts.append(
            "Evidence pointing to entries that do not exist in the candidate sheet (fix or remove them): "
            + ", ".join(bad_evidence)
            + "."
        )
    if bad_clarifications:
        parts.append(
            "Clarification evidence that is not an answer of this request (a skipped question is never"
            " evidence; fix or remove them): " + ", ".join(bad_clarifications) + "."
        )
    return " ".join(parts)


def _validation_errors(exc: StructuredOutputError) -> list[dict]:
    """The Pydantic errors behind a rejected output (the parser wraps them in a ValueError)."""
    if not isinstance(exc, StructuredOutputValidationError):
        return []
    for error in (exc.source, exc.source.__cause__):
        if isinstance(error, ValidationError):
            return error.errors(include_url=False)
    return []


def _rejected_assessment(error: dict) -> dict | None:
    """The assessment an error points to (``assessments.<i>``), reduced to the fields to fix."""
    location = error.get("loc", ())
    rejected = error.get("input")
    if len(location) < 2 or location[0] != "assessments" or not isinstance(rejected, dict):
        return None
    return {
        "criterionKey": rejected.get("criterionKey", rejected.get("criterion_key")),
        "score": rejected.get("score"),
        "rationale": rejected.get("rationale"),
        "evidence": rejected.get("evidence"),
    }


def _rejected_count(errors: list[dict]) -> int:
    return len({error["loc"][1] for error in errors if _rejected_assessment(error) is not None})


def _schema_repair_message(exc: StructuredOutputError, errors: list[dict]) -> str:
    """Instruction of the repair turn after a rejected output: each error with the assessment to fix."""
    if isinstance(exc, MultipleStructuredOutputsError):
        return (
            "You returned multiple structured outputs (" + ", ".join(exc.tool_names) + ") when exactly one is"
            " expected. Submit one structured output with the full answer, strictly following the schema."
        )
    parts = ["Your structured output was rejected by the schema. Submit the full answer again, fixing these errors:"]
    if not errors:
        parts.append(f"- {exc}")
    for error in errors:
        location = ".".join(str(part) for part in error.get("loc", ())) or "(root)"
        line = f"- {location}: {error.get('msg')}."
        rejected = _rejected_assessment(error)
        if rejected is not None:
            line += " Rejected assessment: " + json.dumps(rejected, ensure_ascii=False)
        parts.append(line)
    if any(EVIDENCE_RULE in str(error.get("msg", "")) for error in errors):
        parts.append(EVIDENCE_RULE_HINT)
    return "\n".join(parts)


def _gaps(
    analysis: MatchingAnalysis, request: MatchingAnalyzeRequest
) -> tuple[list[str], list[str], list[str], list[str]]:
    missing, unexpected = coverage_gaps(analysis, request)
    return (
        missing,
        unexpected,
        evidence_gaps(analysis, request.candidate),
        clarification_gaps(analysis, request.clarifications),
    )


def _finalize(analysis: MatchingAnalysis, model_name: str | None) -> MatchingAnalysis:
    analysis.schema_version = SCHEMA_VERSION
    analysis.policy_version = POLICY_VERSION
    analysis.model_name = model_name
    return analysis


def _education_assessment(criterion: MatchingCriterion, candidate: dict) -> CriterionAssessment:
    """Deterministic assessment of the education criterion: evidence = the selected diploma, none at 0."""
    education = criterion.education
    result = score_education(
        candidate,
        EducationRules(
            degree_levels=tuple(education.degree_levels),
            credentials=tuple(education.credentials),
            fields=tuple(education.fields),
        ),
    )
    evidence = [] if result.diploma_index is None else [MatchingEvidence(source="diploma", index=result.diploma_index)]
    return CriterionAssessment(
        criterion_key=criterion.key, score=result.score, rationale=result.rationale, evidence=evidence
    )


def analyze_matching(request: MatchingAnalyzeRequest) -> MatchingAnalysis:
    """Score the candidate sheet against every criterion of the offer sheet.

    Education is scored in code; every other criterion goes to the agent.
    """
    if not request.criteria:
        raise MatchingAnalyzeError("empty_criteria", "The matching has no criterion to score.")

    deterministic = [
        _education_assessment(criterion, request.candidate)
        for criterion in request.criteria
        if criterion.education is not None
    ]
    llm_criteria = [criterion for criterion in request.criteria if criterion.education is None]
    if not llm_criteria:
        logger.info(
            "Matching analysis : deterministic criteria only, no model call : deterministic=%d", len(deterministic)
        )
        # No model call: the provenance stays null, never the configured name.
        return _finalize(MatchingAnalysis(assessments=deterministic), None)

    llm_keys = {criterion.key for criterion in llm_criteria}
    llm_request = request.model_copy(
        update={
            "criteria": llm_criteria,
            # Context of the model only: the education assessment is never its business.
            "previous_assessments": [
                assessment for assessment in request.previous_assessments if assessment.criterion_key in llm_keys
            ],
        }
    )
    scored = _analyze_with_model(llm_request)

    order = {criterion.key: position for position, criterion in enumerate(request.criteria)}
    merged = MatchingAnalysis(
        assessments=sorted(
            [*deterministic, *scored.assessments],
            key=lambda assessment: order.get(assessment.criterion_key, len(order)),
        )
    )
    missing, unexpected = coverage_gaps(merged, request)
    if missing or unexpected:
        # The model subset was already checked: only a broken invariant lands here.
        logger.error(
            "Matching analysis : merged assessments do not cover the request : missing=%d, unexpected=%d",
            len(missing),
            len(unexpected),
        )
        raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE)
    if deterministic:
        logger.info("Matching analysis : deterministic criteria merged : deterministic=%d", len(deterministic))
    # The model was actually called for at least one criterion: stamp the
    # configured model name, never a value the model could have supplied.
    return _finalize(merged, settings.llm_model)


def _analyze_with_model(request: MatchingAnalyzeRequest) -> MatchingAnalysis:
    """One agent run on the request's criteria, then at most one repair turn; never stamped (the caller is)."""
    payload = {
        "criteria": [criterion.model_dump(by_alias=True, exclude_none=True) for criterion in request.criteria],
        "offer": request.offer,
        "candidate": request.candidate,
        # Re-evaluation context (empty on the initial analysis). The
        # clarifications are sent whole, skips included, so that a
        # "clarification" evidence index is the position in this array.
        "previousAssessments": [
            assessment.model_dump(by_alias=True) for assessment in request.previous_assessments
        ],
        "clarifications": [clarification.model_dump(by_alias=True) for clarification in request.clarifications],
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
    except StructuredOutputError as exc:
        # Rejected by the schema: restart from the request, never replay the
        # invalid message. Logs carry the error type and a count, never content.
        errors = _validation_errors(exc)
        logger.warning(
            "Matching analysis : structured output rejected, running repair turn : error=%s, rejected_assessments=%d",
            type(exc).__name__,
            _rejected_count(errors),
        )
        history = messages
        instruction = _schema_repair_message(exc, errors)
    else:
        parsed = result.get("structured_response")
        missing: list[str] = []
        unexpected: list[str] = []
        bad_evidence: list[str] = []
        bad_clarifications: list[str] = []
        if isinstance(parsed, MatchingAnalysis):
            missing, unexpected, bad_evidence, bad_clarifications = _gaps(parsed, request)
            if not missing and not unexpected and not bad_evidence and not bad_clarifications:
                return parsed
            logger.warning(
                "Matching analysis : gaps found, running repair turn : missing=%d, unexpected=%d, bad_evidence=%d,"
                " bad_clarification=%d",
                len(missing),
                len(unexpected),
                len(bad_evidence),
                len(bad_clarifications),
            )
        else:
            logger.warning("Matching analysis : structured output missing, running repair turn")
        # The repair replays this run's history explicitly (no checkpointer).
        history = result["messages"]
        instruction = _repair_message(missing, unexpected, bad_evidence, bad_clarifications)

    # One repair turn only.
    try:
        repair = agent.invoke({"messages": [*history, HumanMessage(content=instruction)]}, config=config)
    except GraphRecursionError as exc:
        raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE) from exc
    except StructuredOutputError as exc:
        logger.warning("Matching analysis : repair turn rejected by the schema : error=%s", type(exc).__name__)
        raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, MatchingAnalysis) and _gaps(parsed, request) == ([], [], [], []):
        logger.info("Matching analysis : repair turn recovered the structured output")
        return parsed

    raise MatchingAnalyzeError("no_output", NO_OUTPUT_MESSAGE)
