"""Contracts for candidate/offer matching (D58): what Spring Boot sends in and
what the agent must return.

The service is stateless: every call carries the whole context — both
normalized sheets as stored (opaque JSON, the backend validated them when
they were produced), the criteria the backend extracted from the offer sheet
with their stable keys, and (from the clarification lot on) the previous
result and every question already asked with its answer. Nothing is kept
between two calls.

The offer sheet is the reference grid: the agent scores the candidate sheet
against each criterion, one by one. It never weighs nor aggregates — the
backend applies the weights and computes the section scores.
"""

from typing import Any, Literal

from pydantic import Field, model_validator

from app.schemas.cv import CvModel

# Format of the analysis returned to the backend (mirrors matching_result
# .schema_version). Versioned independently from the comparison policy
# (policyVersion), which can change without changing the shape.
SCHEMA_VERSION = "1"

MatchingSection = Literal[
    "required_skills",
    "preferred_skills",
    "languages",
    "experience",
    "education",
]

# Where a piece of evidence lives in the candidate sheet. ``bio`` is the only
# source without an index (the bio is a single text).
MatchingEvidenceSource = Literal[
    "bio",
    "experience",
    "project",
    "diploma",
    "certification",
    "language",
    "skill",
]


class MatchingCriterion(CvModel):
    """One criterion extracted by the backend from the offer sheet."""

    key: str = Field(min_length=1, description="Stable criterion key, echoed verbatim in the answer")
    section: MatchingSection = Field(description="Section of the offer sheet the criterion belongs to")
    label: str = Field(min_length=1, description="Human readable name, e.g. 'Java' or 'English'")
    requirement: str | None = Field(
        default=None,
        description="What the offer expects for this criterion, e.g. 'level 4/5, at least 3 years'",
    )


class MatchingAnalyzeRequest(CvModel):
    """Full context of one analysis (the service keeps nothing between calls)."""

    matching_id: str = Field(min_length=1, description="Conversation id, used as LangSmith thread id only")
    candidate: dict[str, Any] = Field(description="Candidate normalized sheet (schema v3), as stored")
    offer: dict[str, Any] = Field(description="Offer normalized sheet (schema v2), as stored")
    criteria: list[MatchingCriterion] = Field(description="Criteria to score, built from the offer sheet")

    @model_validator(mode="after")
    def unique_keys(self) -> "MatchingAnalyzeRequest":
        keys = [criterion.key for criterion in self.criteria]
        if len(keys) != len(set(keys)):
            raise ValueError("criteria keys must be unique")
        return self


class MatchingEvidence(CvModel):
    """Pointer into the candidate sheet supporting a score."""

    source: MatchingEvidenceSource = Field(description="Section of the candidate sheet")
    index: int | None = Field(
        default=None,
        ge=0,
        description="0-based index in that section's array; null only for 'bio'",
    )

    @model_validator(mode="after")
    def index_matches_source(self) -> "MatchingEvidence":
        if self.source == "bio" and self.index is not None:
            raise ValueError("a 'bio' evidence has no index")
        if self.source != "bio" and self.index is None:
            raise ValueError(f"a '{self.source}' evidence needs an index")
        return self


class CriterionAssessment(CvModel):
    """Score of one criterion: 0 when the candidate sheet does not show it."""

    criterion_key: str = Field(description="Key of the scored criterion, copied verbatim from the request")
    score: int = Field(ge=0, le=100, description="0-100; 0 when the candidate sheet does not show the criterion")
    rationale: str = Field(
        min_length=1,
        description="One or two factual sentences explaining the score, for the recruiter",
    )
    evidence: list[MatchingEvidence] = Field(
        default_factory=list,
        description="Where the candidate sheet supports the score; empty when the score is 0",
    )


class MatchingAnalysis(CvModel):
    """Per-criterion scores returned to the backend, which weighs and aggregates."""

    schema_version: str = Field(default=SCHEMA_VERSION, description="Set by the service, not by the model")
    policy_version: str = Field(default="", description="Set by the service, not by the model")
    assessments: list[CriterionAssessment] = Field(
        description="Exactly one assessment per criterion of the request, in any order"
    )

    @model_validator(mode="after")
    def unique_assessments(self) -> "MatchingAnalysis":
        keys = [assessment.criterion_key for assessment in self.assessments]
        if len(keys) != len(set(keys)):
            raise ValueError("each criterion must be assessed exactly once")
        return self
