"""Contracts for profile normalization: what Spring Boot sends in and what
the agent must return.

Input mirrors the backend's CandidateProfileResponse on the wire (camelCase,
full ISO dates ``YYYY-MM-DD``, section ids present but ignored — the canonical
content never carries identifiers). Output is the canonical profile v2: richer
than the CV vocabulary (domains, responsibilities, technologies, achievements,
projects, certifications split from links, a skills index with evidence).
"""

from typing import Literal

from pydantic import Field, model_validator

from app.schemas.cv import (
    CvDiploma,
    CvLanguage,
    CvLink,
    CvModel,
    DATE_PATTERN,
    ReferenceContext,
)

# Canonical format version written into every normalized profile (mirrors the
# backend's schema_version column). v2 = projects section, deep extraction,
# evidence-based skills index, certifications split from links, location.
SCHEMA_VERSION = "2"

Seniority = Literal["junior", "mid", "senior", "lead", "principal"]

SkillCategory = Literal[
    "programming_language",
    "framework",
    "library",
    "tool",
    "methodology",
    "business_domain",
    "soft_skill",
    "technical_skill",
    "regulatory_knowledge",
    "other",
]

ProjectContext = Literal[
    "personal", "academic", "open_source", "professional", "volunteer", "other"
]

EvidenceSource = Literal["experience", "project", "diploma", "certification"]

SkillOrigin = Literal["declared", "inferred"]

LevelSource = Literal["declared", "inferred"]


# ---------------------------------------------------------------------------
# Input: snapshot sent by the backend worker (camelCase on the wire)
# ---------------------------------------------------------------------------


class ProfileAbout(CvModel):
    """About section as stored by the backend (snapshot, not an instruction)."""

    title: str | None = None
    target_position: str | None = None
    bio: str | None = None
    years_of_experience: int | None = None
    search_status: str | None = None


class ProfileExperience(CvModel):
    """One stored experience: full ISO dates as serialized by Jackson."""

    position_title: str | None = None
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    company_name: str | None = None
    company_country: str | None = None


class ProfileProject(CvModel):
    """One stored project: technologies is free text (comma-separated)."""

    name: str | None = None
    role: str | None = None
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    technologies: str | None = None


class ProfileDiploma(CvModel):
    """One stored diploma entry."""

    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    institution: str | None = None
    institution_country: str | None = None
    degree_label: str | None = None
    study_field_label: str | None = None


class ProfileSkill(CvModel):
    """One stored skill (skill_type is platform metadata, not content)."""

    name: str | None = None
    skill_type: str | None = None
    level: int | None = None
    years_experience: int | None = None


class ProfileLanguage(CvModel):
    """One stored language: level is free text on input (CEFR on output)."""

    name: str | None = None
    level: str | None = None


class ProfileLink(CvModel):
    """One stored link; link_type tells certification links from the rest."""

    label: str | None = None
    url: str | None = None
    issuer: str | None = None
    link_type: str | None = None
    issued_at: str | None = None


class ProfileLocation(CvModel):
    """Account location (users table), only present in the normalize body."""

    current_city: str | None = None
    current_country: str | None = None


class CandidateProfile(CvModel):
    """Full profile snapshot sent by the backend worker.

    Unknown fields (section ids, completionPercentage, hasUnvalidatedChanges…)
    are ignored: they are delivery metadata, never content.
    """

    about: ProfileAbout | None = None
    experiences: list[ProfileExperience] = Field(default_factory=list)
    projects: list[ProfileProject] = Field(default_factory=list)
    diplomas: list[ProfileDiploma] = Field(default_factory=list)
    skills: list[ProfileSkill] = Field(default_factory=list)
    languages: list[ProfileLanguage] = Field(default_factory=list)
    links: list[ProfileLink] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_null_sections(cls, data: object) -> object:
        """A null list is an empty list: Jackson may serialize a null field as null."""
        if isinstance(data, dict):
            for key in ("experiences", "projects", "diplomas", "skills", "languages", "links"):
                if data.get(key) is None:
                    data.pop(key, None)
        return data


# ---------------------------------------------------------------------------
# Output: canonical profile v2 produced by the agent (camelCase on the wire)
# ---------------------------------------------------------------------------


class NormalizedExperience(CvModel):
    """One experience, enriched: verbatim description kept plus mined detail."""

    position_title: str = Field(description="Job title as advertised")
    company_name: str = Field(description="Employer name")
    company_country: str | None = Field(default=None, description="Country name as written")
    start_date: str = Field(pattern=DATE_PATTERN, description="Start month, YYYY-MM")
    end_date: str | None = Field(
        default=None, pattern=DATE_PATTERN, description="YYYY-MM, null when current"
    )
    description: str | None = Field(
        default=None, description="Original description text, kept verbatim"
    )
    domain: str | None = Field(
        default=None,
        description="Business or technical domain of the role, e.g. 'fintech payments', null if unstated",
    )
    responsibilities: list[str] = Field(
        default_factory=list,
        description="Concrete responsibilities mined from the description text, own wording",
    )
    technologies: list[str] = Field(
        default_factory=list,
        description="Technologies named or clearly used in this experience",
    )
    achievements: list[str] = Field(
        default_factory=list,
        description="Measurable achievements stated in the description, never invented",
    )


class NormalizedProject(CvModel):
    """One project section entry with mined detail."""

    name: str = Field(description="Project name")
    role: str | None = Field(default=None, description="Candidate's role in the project")
    description: str | None = Field(default=None, description="Original description, verbatim")
    start_date: str = Field(pattern=DATE_PATTERN, description="Start month, YYYY-MM")
    end_date: str | None = Field(
        default=None, pattern=DATE_PATTERN, description="YYYY-MM, null when ongoing"
    )
    context: ProjectContext = Field(
        description="Nature of the project, inferred from the profile's wording"
    )
    domain: str | None = Field(default=None, description="Domain the project belongs to")
    responsibilities: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(
        default_factory=list, description="Technologies used, canonical names where recognisable"
    )
    achievements: list[str] = Field(default_factory=list)


class NormalizedCertification(CvModel):
    """One certification, split out of the links section."""

    name: str = Field(description="Certification name (the link label)")
    issuer: str | None = Field(default=None, description="Issuing organisation")
    issued_at: str | None = Field(
        default=None, pattern=DATE_PATTERN, description="Issue month YYYY-MM when stated"
    )
    url: str | None = Field(default=None, description="Verification URL")


class NormalizedLocation(CvModel):
    """Candidate location taken from the account (never invented)."""

    city: str | None = None
    country: str | None = None


class SkillEvidence(CvModel):
    """Pointer to one item of the canonical profile proving the skill.

    Indices are 0-based positions in the output arrays of the same response —
    never database identifiers (the profile is regenerated atomically).
    """

    source: EvidenceSource = Field(description="Which section the proof comes from")
    index: int = Field(ge=0, description="0-based index into that section's output array")


class NormalizedSkill(CvModel):
    """One entry of the skills index: capability with provenance."""

    name: str = Field(description="Capability name, canonical where recognisable")
    category: SkillCategory = Field(description="Taxonomy category of the capability")
    level: int | None = Field(
        default=None, ge=1, le=5,
        description="Proficiency 1-5: copy the declared level, else infer only when strongly "
        "supported by the texts, else null",
    )
    level_source: LevelSource | None = Field(
        default=None,
        description="'declared' when copied from the skills section, 'inferred' when derived, else null",
    )
    years_experience: int | None = Field(
        default=None, ge=0, le=60,
        description="Sum of non-overlapping evidence periods when computable, else null",
    )
    origin: SkillOrigin = Field(
        description="'declared' when the candidate listed it as a skill, 'inferred' when mined from texts"
    )
    evidence: list[SkillEvidence] = Field(
        default_factory=list, description="Items of this profile that prove the capability"
    )


class NormalizedProfile(CvModel):
    """Canonical profile object v2 produced by the agent (camelCase wire)."""

    schema_version: str = Field(
        default=SCHEMA_VERSION, description="Canonical format version, fixed to '2'"
    )
    title: str | None = Field(default=None, description="Professional headline, e.g. 'Senior Backend Engineer'")
    summary: str | None = Field(
        default=None,
        description="2-3 sentence professional summary written in first person, drawn only from the profile's own content",
    )
    years_of_experience: int | None = Field(
        default=None, ge=0, le=60, description="Total years of professional experience, null if unknown"
    )
    seniority: Seniority | None = Field(
        default=None, description="Inferred career stage, null when not supported by the profile"
    )
    target_role: str | None = Field(
        default=None, description="Position the candidate is looking for (target position), verbatim"
    )
    search_status: str | None = Field(
        default=None, description="Search status as stored, passed through unchanged"
    )
    location: NormalizedLocation | None = Field(
        default=None, description="Account location passed through, never invented"
    )
    experiences: list[NormalizedExperience] = Field(
        default_factory=list, description="Most recent experience first"
    )
    projects: list[NormalizedProject] = Field(
        default_factory=list, description="Most recent project first"
    )
    diplomas: list[CvDiploma] = Field(default_factory=list, description="Most recent diploma first")
    languages: list[CvLanguage] = Field(default_factory=list)
    certifications: list[NormalizedCertification] = Field(
        default_factory=list, description="Split out of the stored certification links"
    )
    links: list[CvLink] = Field(
        default_factory=list, description="Non-certification online presence only"
    )
    skills: list[NormalizedSkill] = Field(
        default_factory=list, description="Capabilities index with evidence; declared first, then inferred"
    )


class NormalizeRequest(CvModel):
    """Body of POST /profile/normalize sent by the backend worker."""

    profile: CandidateProfile
    location: ProfileLocation | None = Field(
        default=None, description="Account location from the users table (optional)"
    )
    context: ReferenceContext | None = Field(
        default=None, description="Reference vocabulary from the backend database (optional)"
    )
