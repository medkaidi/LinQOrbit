"""Validation tests for the profile normalization contract (no LLM involved)."""

import pytest
from pydantic import ValidationError

from app.schemas.cv import CvExperience
from app.schemas.normalize import (
    SCHEMA_VERSION,
    CandidateProfile,
    NormalizeRequest,
    NormalizedProfile,
)


def test_input_payload_parses_the_backend_wire_format():
    """Spring Boot sends camelCase, full ISO dates and section ids: all accepted."""
    profile = CandidateProfile.model_validate(
        {
            "about": {
                "title": "Full Stack Developer",
                "targetPosition": "Backend Developer",
                "bio": "Six years building APIs.",
                "yearsOfExperience": 6,
                "searchStatus": "open_to_work",
            },
            "experiences": [
                {
                    "id": "3f0c1c9e-0000-0000-0000-000000000001",
                    "positionTitle": "Developer",
                    "description": "Backend work",
                    "startDate": "2024-01-15",
                    "endDate": None,
                    "companyName": "A2S",
                    "companyCountry": "France",
                }
            ],
            "diplomas": [
                {
                    "id": "3f0c1c9e-0000-0000-0000-000000000002",
                    "title": "BSc Computer Science",
                    "startDate": "2016-09-01",
                    "endDate": "2019-06-30",
                    "institution": "Sorbonne",
                    "institutionCountry": "France",
                    "degreeId": "3f0c1c9e-0000-0000-0000-000000000003",
                    "degreeLabel": "Bachelor's degree",
                    "studyFieldId": "3f0c1c9e-0000-0000-0000-000000000004",
                    "studyFieldLabel": "Computer Science",
                }
            ],
            "skills": [
                {
                    "skillId": "3f0c1c9e-0000-0000-0000-000000000005",
                    "name": "Java",
                    "skillType": "Programming Languages",
                    "level": 4,
                    "yearsExperience": 6,
                }
            ],
            "languages": [
                {
                    "languageId": "3f0c1c9e-0000-0000-0000-000000000006",
                    "symbol": "🇬🇧",
                    "name": "English",
                    "level": "Professional",
                }
            ],
            "links": [
                {
                    "id": "3f0c1c9e-0000-0000-0000-000000000007",
                    "label": "GitHub",
                    "url": "https://github.com/ada",
                    "linkType": "portfolio",
                    "issuer": None,
                    "issuedAt": None,
                }
            ],
            "completionPercentage": 80,
            "hasUnvalidatedChanges": True,
        }
    )

    assert profile.about.title == "Full Stack Developer"
    assert profile.experiences[0].start_date == "2024-01-15"
    # Ids and delivery metadata are ignored, never stored as content.
    assert "id" not in profile.experiences[0].model_dump()
    assert not hasattr(profile, "completion_percentage")
    assert not hasattr(profile, "has_unvalidated_changes")


def test_input_defaults_to_empty_sections():
    profile = CandidateProfile()

    assert profile.about is None
    assert profile.experiences == []
    assert profile.skills == []


def test_input_accepts_null_sections():
    profile = CandidateProfile.model_validate({"experiences": None, "skills": None})

    assert profile.experiences == []
    assert profile.skills == []


def test_output_wire_format_is_camel_case_and_canonical():
    result = NormalizedProfile(
        title="Senior Backend Engineer",
        summary="I build APIs.",
        years_of_experience=7,
        experiences=[
            CvExperience(
                position_title="Backend Engineer",
                company_name="Acme",
                start_date="2021-03",
                end_date=None,
            )
        ],
    )

    dumped = result.model_dump(by_alias=True)
    assert dumped["schemaVersion"] == SCHEMA_VERSION
    assert dumped["yearsOfExperience"] == 7
    assert dumped["experiences"][0]["positionTitle"] == "Backend Engineer"
    assert dumped["experiences"][0]["startDate"] == "2021-03"
    assert "start_date" not in dumped["experiences"][0]


def test_output_month_pattern_is_enforced():
    with pytest.raises(ValidationError):
        CvExperience(position_title="Dev", company_name="Acme", start_date="2021-03-15")


def test_output_years_of_experience_is_bounded():
    with pytest.raises(ValidationError):
        NormalizedProfile(years_of_experience=200)


def test_normalize_request_parses_the_backend_body():
    request = NormalizeRequest.model_validate(
        {
            "profile": {"about": {"title": "Developer"}, "skills": []},
            "context": {
                "languages": ["French"],
                "degrees": ["Bachelor's degree"],
                "studyFields": ["Computer Science"],
                "skills": {"Software": ["Microsoft Excel"]},
            },
        }
    )

    assert request.profile.about.title == "Developer"
    assert request.context.study_fields == ["Computer Science"]


def test_normalize_request_accepts_a_missing_context():
    request = NormalizeRequest.model_validate({"profile": {}})

    assert request.context is None


def test_json_schema_exposes_camel_case_fields():
    """The schema sent to the LLM and the wire format share one casing."""
    schema = NormalizedProfile.model_json_schema()

    assert "schemaVersion" in schema["properties"]
    assert "schema_version" not in schema["properties"]
    assert "yearsOfExperience" in schema["properties"]
    assert "startDate" in schema["$defs"]["CvExperience"]["properties"]
