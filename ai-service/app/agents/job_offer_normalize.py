"""Job offer normalization pipeline: stored offer -> agent -> NormalizedJobOffer.

No extraction step (the input is already structured, unlike a CV): the
pipeline is the agent plus one repair turn, mirroring ``profile_normalize``.
"""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.graphs.job_offer_normalize_agent import build_job_offer_normalize_agent
from app.schemas.cv import ReferenceContext
from app.schemas.job_offer import (
    SCHEMA_VERSION,
    JobOfferSnapshot,
    NormalizedJobOffer,
)

logger = logging.getLogger(__name__)

# Same backstop as the profile pipeline: ModelCallLimitMiddleware ends the
# run first with structured_response=None, which gives the repair turn its
# chance.
RECURSION_LIMIT = 32


class JobOfferNormalizeError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def has_content(offer: JobOfferSnapshot) -> bool:
    """True when the snapshot carries anything worth normalizing."""
    if offer.company is not None and any(
        value is not None for value in offer.company.model_dump().values()
    ):
        return True
    scalar_fields = (
        offer.title,
        offer.description,
        offer.seniority,
        offer.required_exp_year,
        offer.city,
        offer.country,
        offer.contract_type_label,
        offer.employment_type_label,
        offer.work_mode_label,
        offer.salary_min,
        offer.salary_max,
        offer.salary_currency,
        offer.salary_period,
    )
    if any(value is not None for value in scalar_fields):
        return True
    return any(
        (
            offer.skills,
            offer.languages,
            offer.degree_labels,
            offer.study_field_labels,
        )
    )


def normalize_job_offer(
    offer: JobOfferSnapshot,
    context: ReferenceContext | None = None,
) -> NormalizedJobOffer:
    """Run the agent over the stored offer and return a validated object.

    ``context`` is the backend's reference vocabulary (DB truth), rendered
    into the system prompt as canonicalisation lists.
    """
    if not has_content(offer):
        raise JobOfferNormalizeError(
            "empty_offer",
            "The offer has no content to normalize.",
        )

    payload = {
        "offer": offer.model_dump(by_alias=True, exclude_none=True),
    }
    agent = build_job_offer_normalize_agent(context=context)
    config = {"recursion_limit": RECURSION_LIMIT}
    try:
        result = agent.invoke(
            {
                "messages": [
                    HumanMessage(
                        content="Normalize the following job offer:\n\n"
                        + json.dumps(payload, ensure_ascii=False)
                    )
                ]
            },
            config=config,
        )
    except GraphRecursionError as exc:
        raise JobOfferNormalizeError(
            "no_output",
            "The agent could not produce a valid structure for this offer.",
        ) from exc

    parsed = result.get("structured_response")
    if isinstance(parsed, NormalizedJobOffer):
        parsed.schema_version = SCHEMA_VERSION
        return parsed

    # One repair turn, replaying this run's history explicitly (no checkpointer)
    # so the model sees its own unfinished answer and can submit the schema now.
    logger.warning("Job offer normalization : structured output missing, running repair turn")
    try:
        repair = agent.invoke(
            {
                "messages": [
                    *result["messages"],
                    HumanMessage(
                        content="You finished without the structured output. Submit it now, "
                        "strictly following the schema."
                    ),
                ]
            },
            config=config,
        )
    except GraphRecursionError as exc:
        raise JobOfferNormalizeError(
            "no_output",
            "The agent could not produce a valid structure for this offer.",
        ) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, NormalizedJobOffer):
        logger.info("Job offer normalization : repair turn recovered the structured output")
        parsed.schema_version = SCHEMA_VERSION
        return parsed

    raise JobOfferNormalizeError(
        "no_output",
        "The agent could not produce a valid structure for this offer.",
    )
