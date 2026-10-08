"""Profile normalization pipeline: stored profile -> agent -> NormalizedProfile.

No extraction step (the input is already structured, unlike a CV): the
pipeline is the agent plus one repair turn, mirroring ``cv_parse``.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.graphs.normalize_agent import build_normalize_agent
from app.schemas.cv import ReferenceContext
from app.schemas.normalize import SCHEMA_VERSION, CandidateProfile, NormalizedProfile

logger = logging.getLogger(__name__)

# Same backstop as the CV pipeline: ModelCallLimitMiddleware ends the run
# first with structured_response=None, which gives the repair turn its chance.
RECURSION_LIMIT = 32


class ProfileNormalizeError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def has_content(profile: CandidateProfile) -> bool:
    """True when the snapshot carries anything worth normalizing."""
    if profile.about is not None and any(
        value is not None for value in profile.about.model_dump().values()
    ):
        return True
    return any(
        (
            profile.experiences,
            profile.diplomas,
            profile.skills,
            profile.languages,
            profile.links,
        )
    )


def normalize_profile(
    profile: CandidateProfile, context: ReferenceContext | None = None
) -> NormalizedProfile:
    """Run the agent over the stored profile and return a validated object.

    ``context`` is the backend's reference vocabulary (DB truth): it is
    rendered into the system prompt as canonicalisation lists.
    """
    if not has_content(profile):
        raise ProfileNormalizeError(
            "empty_profile",
            "The profile has no content to normalize.",
        )

    payload = profile.model_dump_json(by_alias=True, exclude_none=True)
    agent = build_normalize_agent(context=context)
    config = {"recursion_limit": RECURSION_LIMIT}
    try:
        result = agent.invoke(
            {
                "messages": [
                    HumanMessage(content=f"Normalize the following candidate profile:\n\n{payload}")
                ]
            },
            config=config,
        )
    except GraphRecursionError as exc:
        raise ProfileNormalizeError(
            "no_output",
            "The agent could not produce a valid structure for this profile.",
        ) from exc

    parsed = result.get("structured_response")
    if isinstance(parsed, NormalizedProfile):
        parsed.schema_version = SCHEMA_VERSION
        return parsed

    # One repair turn, replaying this run's history explicitly (no checkpointer)
    # so the model sees its own unfinished answer and can submit the schema now.
    logger.warning("Profile normalization : structured output missing, running repair turn")
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
        raise ProfileNormalizeError(
            "no_output",
            "The agent could not produce a valid structure for this profile.",
        ) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, NormalizedProfile):
        logger.info("Profile normalization : repair turn recovered the structured output")
        parsed.schema_version = SCHEMA_VERSION
        return parsed

    raise ProfileNormalizeError(
        "no_output",
        "The agent could not produce a valid structure for this profile.",
    )
