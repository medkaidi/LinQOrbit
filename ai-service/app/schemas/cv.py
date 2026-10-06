"""Structured output contract for CV parsing: what the agent must return.

Field descriptions are not decoration — they are sent to the LLM inside the
JSON Schema, so the model knows exactly what each field means.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Levels shared with the frontend reference catalogs (see frontend AGENTS.md).
CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]

DATE_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class CvModel(BaseModel):
    """Shared contract: the JSON wire format is camelCase (alias generator)
    while Python code keeps snake_case fields (populate_by_name accepts both)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CvExperience(CvModel):
    """One professional experience extracted from the CV."""

    position_title: str = Field(description="Job title as advertised, e.g. 'Backend Engineer'")
    company_name: str = Field(description="Employer name")
    company_country: str | None = Field(
        default=None, description="Country name as written in the CV, e.g. 'France'"
    )
    start_date: str = Field(pattern=DATE_PATTERN, description="Start month, YYYY-MM")
    end_date: str | None = Field(
        default=None,
        pattern=DATE_PATTERN,
        description="End month YYYY-MM, null when the position is current",
    )
    description: str | None = Field(
        default=None, description="Short summary of the role and achievements"
    )


class CvDiploma(CvModel):
    """One education entry extracted from the CV."""

    title: str = Field(description="Diploma or degree name, e.g. 'MSc Computer Science'")
    institution: str = Field(description="School or university name")
    institution_country: str | None = Field(
        default=None, description="Country name as written in the CV"
    )
    degree_label: str | None = Field(
        default=None, description="Degree category if recognisable (matched later against the catalogue)"
    )
    study_field_label: str | None = Field(
        default=None, description="Field of study if recognisable (matched later against the catalogue)"
    )
    start_date: str = Field(pattern=DATE_PATTERN, description="Start month, YYYY-MM")
    end_date: str | None = Field(default=None, pattern=DATE_PATTERN, description="End month YYYY-MM")


class CvSkill(CvModel):
    """One skill extracted from the CV."""

    name: str = Field(description="Skill name, e.g. 'Kubernetes'")
    level: int | None = Field(
        default=None, ge=1, le=5, description="Proficiency from 1 (beginner) to 5 (expert), null if unknown"
    )
    years_experience: int | None = Field(
        default=None, ge=0, le=60, description="Years of hands-on experience with this skill, null if unknown"
    )


class CvLanguage(CvModel):
    """One spoken/written language extracted from the CV."""

    name: str = Field(description="Language name, e.g. 'French'")
    level: CefrLevel | None = Field(default=None, description="CEFR level when stated or clearly inferable")


class CvLink(CvModel):
    """One online presence extracted from the CV (portfolio, GitHub, certification...)."""

    label: str = Field(description="Display label, e.g. 'GitHub'")
    url: str = Field(description="Full URL including https://")


class ParsedCv(CvModel):
    """Everything the agent extracted from one CV file."""

    title: str | None = Field(default=None, description="Professional headline, e.g. 'Senior Backend Engineer'")
    summary: str | None = Field(
        default=None, description="2-3 sentence professional summary written in first person"
    )
    experiences: list[CvExperience] = Field(default_factory=list, description="Most recent experience first")
    diplomas: list[CvDiploma] = Field(default_factory=list, description="Most recent diploma first")
    skills: list[CvSkill] = Field(default_factory=list)
    languages: list[CvLanguage] = Field(default_factory=list)
    links: list[CvLink] = Field(default_factory=list)


class ReferenceContext(CvModel):
    """Reference vocabulary sent by Spring Boot with each PDF (optional part).

    Source of truth is the platform database: the prompt tells the model to
    canonicalise languages, degrees, study fields and skills against these
    lists while keeping the candidate's own wording everywhere else.
    """

    languages: list[str] = Field(default_factory=list, description="English language names, e.g. 'French'")
    degrees: list[str] = Field(default_factory=list, description="Degree labels, e.g. \"Bachelor's degree\"")
    study_fields: list[str] = Field(default_factory=list, description="Field of study labels")
    skills: dict[str, list[str]] = Field(
        default_factory=dict, description="Skill families -> skill names, grouped by the backend"
    )
