"""Contracts for job offer normalization: what Spring Boot sends in and what
the agent must return.

Input mirrors the stored offer on the wire (camelCase, resolved vocabulary
labels, description already stripped of HTML by the backend worker — the
canonical content never carries identifiers). Output is the canonical offer
v2: the offer mined the way candidate profiles are (deep extraction of every
free text into responsibilities, skill groups, certifications and education
requirements), so the matching engine compares the two sheets on their shared
fields (skills, languages, seniority, location, degrees, study fields)
without any translation layer.

v2 adds the criteria the recruiter cannot always be bothered to fill in
fields: weights everywhere (declared weight copied, missing weight judged
from the role's own wording), total/degree/study-field requirements and
certifications — declared values are never overwritten, mined values always
carry their provenance so the matcher can treat declared as hard filters and
inferred as advisory signals.

Skill primitives (category taxonomy, origin discipline, evidence pointers)
are shared with ``app.schemas.normalize`` on purpose: a requirement and a
candidate capability must be comparable without translation.
"""

from typing import Literal

from pydantic import Field, model_validator

from app.schemas.cv import DATE_PATTERN, CefrLevel, CvModel, ReferenceContext
from app.schemas.normalize import (
    LevelSource,
    NormalizedLocation,
    Seniority,
    SkillCategory,
    SkillOrigin,
)

# Canonical format version written into every normalized offer (mirrors the
# backend's schema_version column). v2 = weights on every criterion, mined
# total experience / degrees / study fields / certifications, language
# origin. Versioned independently from the candidate profile: they are
# different objects with their own compatibility contract.
SCHEMA_VERSION = "2"

ContractType = Literal[
    "permanent",
    "fixed_term",
    "freelance",
    "internship",
    "apprenticeship",
    "volunteer",
]

WorkTime = Literal["full_time", "part_time"]

WorkMode = Literal["remote", "hybrid", "on_site"]

ResponsibilityImportance = Literal["mandatory", "optional"]

OfferEvidenceSource = Literal["responsibility"]


# ---------------------------------------------------------------------------
# Input: snapshot sent by the backend worker (camelCase on the wire)
# ---------------------------------------------------------------------------


class JobOfferCompany(CvModel):
    """Hiring company as stored by the backend (pitch source, not an instruction)."""

    name: str | None = None
    description: str | None = None


class JobOfferSkillInput(CvModel):
    """One stored skill criterion: the requirement type is platform truth."""

    name: str | None = None
    requirement_type: str | None = None
    weight: int | None = None
    years_experience: int | None = None


class JobOfferLanguageInput(CvModel):
    """One stored language criterion: level is free text on input (CEFR on output)."""

    name: str | None = None
    level: str | None = None
    is_required: bool | None = None


class JobOfferSnapshot(CvModel):
    """Full offer snapshot sent by the backend worker.

    Unknown fields (section ids, status, dirty-flag) are ignored: they are
    delivery metadata, never content. Vocabulary arrives as resolved labels
    (``contractTypeLabel`` …), never as database identifiers.
    """

    title: str | None = None
    description: str | None = None
    seniority: str | None = None
    required_exp_year: int | None = None
    city: str | None = None
    country: str | None = None
    contract_type_label: str | None = None
    employment_type_label: str | None = None
    work_mode_label: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_period: str | None = None
    company: JobOfferCompany | None = None
    skills: list[JobOfferSkillInput] = Field(default_factory=list)
    languages: list[JobOfferLanguageInput] = Field(default_factory=list)
    degree_labels: list[str] = Field(default_factory=list)
    study_field_labels: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_null_sections(cls, data: object) -> object:
        """A null list is an empty list: Jackson may serialize a null field as null."""
        if isinstance(data, dict):
            for key in (
                "skills",
                "languages",
                "degree_labels",
                "degreeLabels",
                "study_field_labels",
                "studyFieldLabels",
            ):
                if data.get(key) is None:
                    data.pop(key, None)
        return data


# ---------------------------------------------------------------------------
# Output: canonical offer v2 produced by the agent (camelCase on the wire)
# ---------------------------------------------------------------------------


class JobOfferSalary(CvModel):
    """Salary band passed through from the stored offer, never invented."""

    min: float | None = None
    max: float | None = None
    currency: str | None = None
    period: str | None = None


class JobOfferLanguageRequirement(CvModel):
    """One language requirement: CEFR level, provenance of the entry."""

    name: str = Field(description="Language name, e.g. 'English'")
    level: CefrLevel | None = Field(
        default=None, description="CEFR grade when stated or clearly inferable, else null"
    )
    required: bool = Field(
        default=True, description="True when mandatory, false when nice-to-have"
    )
    origin: SkillOrigin = Field(
        description="'declared' when it comes from the stored language criteria, "
        "'inferred' when mined from the texts"
    )


class NormalizedResponsibility(CvModel):
    """One responsibility mined from the offer texts (never a paragraph copy).

    The snapshot carries no stored responsibilities: every entry is mined,
    so both its importance and its weight are the model's reading of the
    offer's own wording.
    """

    text: str = Field(description="The responsibility, in the offer's own wording")
    importance: ResponsibilityImportance = Field(
        description="'mandatory' when the offer presents it as core duty, 'optional' otherwise"
    )
    weight: int = Field(
        ge=1,
        le=5,
        description="Centrality of this duty to the role, 1-5: 5 for a pivot duty the "
        "offer is built around, 1 for a marginal one; judged from the offer's wording",
    )
    domain: str | None = Field(
        default=None, description="Business or technical domain, e.g. 'observability'"
    )
    technologies: list[str] = Field(
        default_factory=list,
        description="Technologies named or clearly involved in this responsibility",
    )


class OfferSkillEvidence(CvModel):
    """Pointer to one responsibility of the same response proving the skill.

    Indices are 0-based positions in the output responsibilities array —
    never database identifiers (the offer is regenerated atomically).
    """

    source: OfferEvidenceSource = Field(
        description="Which section the proof comes from (v2: responsibilities only)"
    )
    index: int = Field(ge=0, description="0-based index into the responsibilities array")


class OfferSkillRequirement(CvModel):
    """One entry of a skill group: required and preferred share this shape."""

    name: str = Field(description="Capability name, canonical where recognisable")
    category: SkillCategory = Field(description="Taxonomy category of the capability")
    weight: int = Field(
        ge=1,
        le=5,
        description="Importance of this skill to the role, 1-5: copy the recruiter's "
        "weight verbatim when the criterion is declared, else judge from the offer's "
        "own wording (5 = pivot skill, 1 = passing mention)",
    )
    level: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Required proficiency 1-5: copy the declared expectation, else infer "
        "only when strongly supported by the texts, else null",
    )
    level_source: LevelSource | None = Field(
        default=None,
        description="'declared' when copied from the stored criterion, "
        "'inferred' when derived, else null",
    )
    min_years: int | None = Field(
        default=None,
        ge=0,
        le=60,
        description="Minimum years with this skill: copy the declared expectation, else "
        "infer only from an explicit statement ('3 years of Java required'), else null",
    )
    min_years_source: LevelSource | None = Field(
        default=None,
        description="'declared' when copied from the stored criterion, "
        "'inferred' when mined from the texts, else null",
    )
    origin: SkillOrigin = Field(
        description="'declared' when the recruiter listed it as a criterion, "
        "'inferred' when mined from texts"
    )
    evidence: list[OfferSkillEvidence] = Field(
        default_factory=list, description="Responsibilities of this offer proving the skill"
    )


class OfferRequirementEntry(CvModel):
    """One education requirement: the label plus where it came from."""

    label: str = Field(
        description="Requirement wording, canonical against the reference lists when possible"
    )
    source: SkillOrigin = Field(
        description="'declared' when copied from the stored labels, "
        "'inferred' when mined from the texts"
    )


class OfferCertification(CvModel):
    """One certification the offer explicitly requires or names (never invented)."""

    name: str = Field(description="Certification name as the offer states it")
    issuer: str | None = Field(default=None, description="Issuing organisation when stated")
    issued_at: str | None = Field(
        default=None, pattern=DATE_PATTERN, description="Issue month YYYY-MM when stated"
    )
    url: str | None = Field(default=None, description="Verification URL when stated")


class NormalizedJobOffer(CvModel):
    """Canonical offer object v2 produced by the agent (camelCase wire)."""

    schema_version: str = Field(
        default=SCHEMA_VERSION, description="Canonical format version, fixed to '2'"
    )
    title: str | None = Field(default=None, description="Offer title as advertised")
    alternate_titles: list[str] = Field(
        default_factory=list, description="Equivalent titles mined from the texts"
    )
    domain: str | None = Field(
        default=None, description="Business domain of the role, e.g. 'fintech payments'"
    )
    contract_type: ContractType | None = Field(default=None, description="Canonical contract type")
    work_time: WorkTime | None = Field(default=None, description="Full-time or part-time")
    seniority: Seniority | None = Field(
        default=None, description="Targeted career stage, null when not supported by the offer"
    )
    work_mode: WorkMode | None = Field(default=None, description="Remote, hybrid or on-site")
    location: NormalizedLocation | None = Field(
        default=None, description="Offer location passed through, never invented"
    )
    salary: JobOfferSalary | None = Field(
        default=None, description="Salary band passed through, null when unstated"
    )
    required_years: int | None = Field(
        default=None,
        ge=0,
        le=60,
        description="Total professional experience the role demands: copy the stored "
        "expectation verbatim, else infer only from an explicit total-experience "
        "statement, else null — never from per-skill mentions",
    )
    required_years_source: LevelSource | None = Field(
        default=None,
        description="'declared' when copied from the stored expectation, "
        "'inferred' when mined from the texts, else null",
    )
    required_degrees: list[OfferRequirementEntry] = Field(
        default_factory=list,
        description="Degree requirements: stored labels first, then explicit statements "
        "mined from the texts",
    )
    required_study_fields: list[OfferRequirementEntry] = Field(
        default_factory=list,
        description="Field-of-study requirements: stored labels first, then explicit "
        "statements mined from the texts",
    )
    languages: list[JobOfferLanguageRequirement] = Field(default_factory=list)
    summary: str | None = Field(
        default=None,
        description="2-3 sentence summary of the role drawn only from the offer's own content",
    )
    company_pitch: str | None = Field(
        default=None, description="Company presentation kept verbatim"
    )
    description: str | None = Field(
        default=None, description="Offer description text (plain text), kept verbatim"
    )
    responsibilities: list[NormalizedResponsibility] = Field(default_factory=list)
    required_skills: list[OfferSkillRequirement] = Field(
        default_factory=list, description="Mandatory skills: declared first, then inferred"
    )
    preferred_skills: list[OfferSkillRequirement] = Field(
        default_factory=list, description="Nice-to-have skills: declared first, then inferred"
    )
    certifications: list[OfferCertification] = Field(
        default_factory=list,
        description="Certifications the offer explicitly requires or names, never assumed",
    )
    benefits: list[str] = Field(
        default_factory=list, description="Benefits stated by the offer, never invented"
    )


class JobOfferNormalizeRequest(CvModel):
    """Body of POST /job-offer/normalize sent by the backend worker."""

    offer: JobOfferSnapshot
    context: ReferenceContext | None = Field(
        default=None, description="Reference vocabulary from the backend database (optional)"
    )
