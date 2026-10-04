"""Validation tests for the CV parsing contract (no LLM involved)."""

import pytest
from pydantic import ValidationError

from app.schemas.cv import CvExperience, CvLanguage, CvSkill, ParsedCv


def test_empty_payload_is_valid():
    """Every field is optional: the agent may legitimately find nothing."""
    parsed = ParsedCv()

    assert parsed.experiences == []
    assert parsed.skills == []
    assert parsed.title is None


def test_full_payload_parses():
    parsed = ParsedCv(
        title="Senior Backend Engineer",
        summary="I build APIs that scale.",
        experiences=[
            {
                "position_title": "Backend Engineer",
                "company_name": "Acme",
                "company_country": "France",
                "start_date": "2023-04",
                "end_date": None,
                "description": "Owned the public API.",
            }
        ],
        diplomas=[
            {
                "title": "MSc Computer Science",
                "institution": "Sorbonne",
                "start_date": "2016-09",
                "end_date": "2018-06",
            }
        ],
        skills=[{"name": "Java", "level": 4, "years_experience": 7}],
        languages=[{"name": "French", "level": "C2"}],
        links=[{"label": "GitHub", "url": "https://github.com/camille"}],
    )

    assert parsed.experiences[0].end_date is None
    assert parsed.skills[0].level == 4
    assert parsed.languages[0].level == "C2"


def test_month_pattern_is_enforced():
    """Dates must already be normalised to YYYY-MM: free text never reaches the API."""
    with pytest.raises(ValidationError):
        CvExperience(position_title="Dev", company_name="Acme", start_date="March 2021")

    with pytest.raises(ValidationError):
        CvExperience(position_title="Dev", company_name="Acme", start_date="2021-13")


def test_language_level_must_be_cefr():
    with pytest.raises(ValidationError):
        CvLanguage(name="French", level="C3")


def test_skill_level_is_bounded():
    with pytest.raises(ValidationError):
        CvSkill(name="Java", level=9)
