"""Contracts for profile normalization: what Spring Boot sends in and what
the agent must return.

Input mirrors the backend's CandidateProfileResponse on the wire (camelCase,
full ISO dates ``YYYY-MM-DD``, section ids present but ignored — the canonical
content never carries identifiers). Output reuses the CV building blocks so
parsed and normalized structures share one vocabulary.
"""

from pydantic import Field, model_validator

from app.schemas.cv import (
    CvDiploma,
    CvExperience,
    CvLanguage,
    CvLink,
    CvModel,
    CvSkill,
    ReferenceContext,
)

# Canonical format version written into every normalized profile (mirrors the
# backend's schema_version column).
SCHEMA_VERSION = "1"


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
    """One stored link (link_type / issuer stay platform metadata on input)."""

    label: str | None = None
    url: str | None = None
    issuer: str | None = None


class CandidateProfile(CvModel):
    """Full profile snapshot sent by the backend worker.

    Unknown fields (section ids, completionPercentage, hasUnvalidatedChanges…)
    are ignored: they are delivery metadata, never content.
    """

    about: ProfileAbout | None = None
    experiences: list[ProfileExperience] = Field(default_factory=list)
    diplomas: list[ProfileDiploma] = Field(default_factory=list)
    skills: list[ProfileSkill] = Field(default_factory=list)
    languages: list[ProfileLanguage] = Field(default_factory=list)
    links: list[ProfileLink] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce_null_sections(cls, data: object) -> object:
        """A null list is an empty list: Jackson may serialize a null field as null."""
        if isinstance(data, dict):
            for key in ("experiences", "diplomas", "skills", "languages", "links"):
                if data.get(key) is None:
                    data.pop(key, None)
        return data


class NormalizedProfile(CvModel):
    """Canonical profile object v1 produced by the agent (camelCase wire)."""

    schema_version: str = Field(
        default=SCHEMA_VERSION, description="Canonical format version, fixed to '1'"
    )
    title: str | None = Field(default=None, description="Professional headline, e.g. 'Senior Backend Engineer'")
    summary: str | None = Field(
        default=None,
        description="2-3 sentence professional summary written in first person, drawn only from the profile's own content",
    )
    years_of_experience: int | None = Field(
        default=None, ge=0, le=60, description="Total years of professional experience, null if unknown"
    )
    experiences: list[CvExperience] = Field(default_factory=list, description="Most recent experience first")
    diplomas: list[CvDiploma] = Field(default_factory=list, description="Most recent diploma first")
    skills: list[CvSkill] = Field(default_factory=list)
    languages: list[CvLanguage] = Field(default_factory=list)
    links: list[CvLink] = Field(default_factory=list)


class NormalizeRequest(CvModel):
    """Body of POST /profile/normalize sent by the backend worker."""

    profile: CandidateProfile
    context: ReferenceContext | None = Field(
        default=None, description="Reference vocabulary from the backend database (optional)"
    )
