"""Contracts for candidate/offer matching (D58): what Spring Boot sends in and
what the agents must return.

The service is stateless: every call carries the whole context — both
normalized sheets as stored (opaque JSON, the backend validated them when
they were produced), the criteria the backend extracted from the offer sheet
with their stable keys, and (from the clarification round on) the previous
assessments and every question already asked with its answer or skip.
Nothing is kept between two calls.

The offer sheet is the reference grid: the agent scores the candidate sheet
against each criterion, one by one. It never weighs nor aggregates — the
backend applies the weights and computes the section scores.
"""

from typing import Any, Literal

from pydantic import Field, model_validator

from app.schemas.cv import CvModel
from app.schemas.job_offer import SCHEMA_VERSION as OFFER_SCHEMA_VERSION
from app.schemas.normalize import SCHEMA_VERSION as CANDIDATE_SCHEMA_VERSION
from app.schemas.normalize import EvidenceSource

# Format of the analysis returned to the backend (mirrors matching_result
# .schema_version). Versioned independently from the comparison policy
# (policyVersion), which can change without changing the shape.
SCHEMA_VERSION = "1"

# Ceiling of job_offer.max_clarification_questions (0-10): the remaining
# budget sent with a clarification request can never exceed it.
MAX_CLARIFICATION_QUESTIONS = 10

MatchingSection = Literal[
    "required_skills",
    "preferred_skills",
    "languages",
    "experience",
    "education",
]

# Where a piece of evidence lives: the sources of the normalized profile
# (``EvidenceSource``, shared with the skill evidence), the two other arrays
# of the candidate sheet a criterion can point to, and the clarifications of
# the request (a candidate's answer). Unlike ``SkillEvidence``, a ``bio``
# evidence must not carry an index: the bio is a single text — every other
# source, ``clarification`` included, needs one.
MatchingEvidenceSource = Literal[EvidenceSource, "language", "skill", "clarification"]

# Array of the candidate sheet (camelCase, as stored) behind each indexed
# source. ``clarification`` is not in the sheet: it points into the
# ``clarifications`` array of the request and is checked separately.
EVIDENCE_ARRAYS: dict[str, str] = {
    "experience": "experiences",
    "project": "projects",
    "diploma": "diplomas",
    "certification": "certifications",
    "language": "languages",
    "skill": "skills",
}

ClarificationStatus = Literal["answered", "skipped"]


class MatchingCriterion(CvModel):
    """One criterion extracted by the backend from the offer sheet."""

    key: str = Field(min_length=1, description="Stable criterion key, echoed verbatim in the answer")
    section: MatchingSection = Field(description="Section of the offer sheet the criterion belongs to")
    label: str = Field(min_length=1, description="Human readable name, e.g. 'Java' or 'English'")
    requirement: str | None = Field(
        default=None,
        description="What the offer expects for this criterion, e.g. 'level 4/5, at least 3 years'",
    )


class MatchingEvidence(CvModel):
    """Pointer into the candidate sheet, or into the clarifications of the request, supporting a score."""

    source: MatchingEvidenceSource = Field(
        description="Section of the candidate sheet, or 'clarification' for a candidate's answer"
    )
    index: int | None = Field(
        default=None,
        ge=0,
        description="0-based index in that section's array (or in the request clarifications); null only for 'bio'",
    )

    @model_validator(mode="after")
    def index_matches_source(self) -> "MatchingEvidence":
        if self.source == "bio" and self.index is not None:
            raise ValueError("a 'bio' evidence has no index")
        if self.source != "bio" and self.index is None:
            raise ValueError(f"a '{self.source}' evidence needs an index")
        return self


class CriterionAssessment(CvModel):
    """Score of one criterion: 0 without evidence, above 0 with at least one evidence."""

    criterion_key: str = Field(description="Key of the scored criterion, copied verbatim from the request")
    score: int = Field(ge=0, le=100, description="0-100; 0 when the candidate sheet does not show the criterion")
    rationale: str = Field(
        min_length=1,
        description="One or two factual sentences explaining the score, for the recruiter only",
    )
    evidence: list[MatchingEvidence] = Field(
        default_factory=list,
        description="What supports the score; empty when the score is 0, at least one entry above 0",
    )

    @model_validator(mode="after")
    def evidence_matches_score(self) -> "CriterionAssessment":
        if self.score == 0 and self.evidence:
            raise ValueError("a score of 0 has no evidence")
        if self.score > 0 and not self.evidence:
            raise ValueError("a score above 0 needs at least one evidence")
        return self


class ClarificationHistory(CvModel):
    """One clarification question already asked, with the candidate's answer or skip."""

    question: str = Field(min_length=1, description="Question asked to the candidate")
    rationale: str | None = Field(default=None, description="Why the question was asked, as shown to the candidate")
    answer: str | None = Field(default=None, description="Candidate's answer; null when the question was skipped")
    status: ClarificationStatus = Field(description="'answered' or 'skipped' (a skip is never information)")

    @model_validator(mode="after")
    def answer_matches_status(self) -> "ClarificationHistory":
        # A skip must stay a skip: no text the agent could mistake for an answer.
        if self.status == "answered" and (self.answer is None or not self.answer.strip()):
            raise ValueError("an answered clarification needs a non-empty answer")
        if self.status == "skipped" and self.answer is not None:
            raise ValueError("a skipped clarification has no answer")
        return self


class MatchingContext(CvModel):
    """Context shared by every matching call (the service keeps nothing between calls)."""

    matching_id: str = Field(min_length=1, description="Conversation id, used as LangSmith thread id only")
    candidate: dict[str, Any] = Field(description="Candidate normalized sheet (schema v3), as stored")
    offer: dict[str, Any] = Field(description="Offer normalized sheet (schema v2), as stored")
    criteria: list[MatchingCriterion] = Field(description="Criteria of the offer sheet, built by the backend")

    @model_validator(mode="after")
    def unique_keys(self) -> "MatchingContext":
        keys = [criterion.key for criterion in self.criteria]
        if len(keys) != len(set(keys)):
            raise ValueError("criteria keys must be unique")
        return self

    @model_validator(mode="after")
    def current_sheet_schemas(self) -> "MatchingContext":
        # The backend refuses outdated sheets first (409); this guard keeps an
        # old sheet from producing evidence indexes into the wrong shape.
        if self.candidate.get("schemaVersion") != CANDIDATE_SCHEMA_VERSION:
            raise ValueError(f"candidate sheet must use schemaVersion {CANDIDATE_SCHEMA_VERSION}")
        if self.offer.get("schemaVersion") != OFFER_SCHEMA_VERSION:
            raise ValueError(f"offer sheet must use schemaVersion {OFFER_SCHEMA_VERSION}")
        return self


class MatchingAnalyzeRequest(MatchingContext):
    """Full context of one analysis: the initial one, or a re-evaluation after clarifications."""

    previous_assessments: list[CriterionAssessment] = Field(
        default_factory=list,
        description="Assessments of the previous result (context, not authority); empty on the initial analysis",
    )
    clarifications: list[ClarificationHistory] = Field(
        default_factory=list,
        description="Every clarification already asked, oldest first; 'clarification' evidence indexes into it",
    )


class MatchingClarifyRequest(MatchingContext):
    """Full context to pick the next clarification question."""

    assessments: list[CriterionAssessment] = Field(
        description="Latest assessments, exactly one per criterion of the request"
    )
    clarifications: list[ClarificationHistory] = Field(
        default_factory=list,
        description="Every clarification already asked, oldest first",
    )
    remaining_questions: int = Field(
        ge=0,
        le=MAX_CLARIFICATION_QUESTIONS,
        description="Questions the candidate can still be asked; 0 means no question",
    )

    @model_validator(mode="after")
    def assessments_cover_the_criteria(self) -> "MatchingClarifyRequest":
        keys = [assessment.criterion_key for assessment in self.assessments]
        if len(keys) != len(set(keys)):
            raise ValueError("each criterion must be assessed exactly once")
        if set(keys) != {criterion.key for criterion in self.criteria}:
            raise ValueError("assessments must cover exactly the criteria of the request")
        return self


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


class ClarificationQuestion(CvModel):
    """The next question for the candidate; both texts are shown to the candidate."""

    question: str = Field(
        min_length=1,
        max_length=400,
        description="One self-contained question naming the offer expectation it relates to",
    )
    rationale: str = Field(
        min_length=1,
        max_length=600,
        description="Why the question is asked, neutral; never a score, a weight or the matching engine",
    )


class ClarificationSuggestion(CvModel):
    """Answer of the clarification agent: the next question, or null when none is worth asking."""

    question: ClarificationQuestion | None = Field(
        default=None,
        description="The next question, or null when no valuable question remains or the budget is 0",
    )
