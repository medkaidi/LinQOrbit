"""Validation tests for the profile normalization contract (no LLM involved)."""

import pytest
from pydantic import ValidationError

from app.schemas.normalize import (
    SCHEMA_VERSION,
    CandidateProfile,
    NormalizeRequest,
    NormalizedCertification,
    NormalizedDiploma,
    NormalizedExperience,
    NormalizedLanguage,
    NormalizedProfile,
    NormalizedSkill,
    SkillEvidence,
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
            "projects": [
                {
                    "id": "3f0c1c9e-0000-0000-0000-000000000008",
                    "name": "Portfolio",
                    "role": "Author",
                    "description": "Personal site",
                    "startDate": "2023-01-01",
                    "endDate": None,
                    "technologies": "Next.js, TypeScript",
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
    assert profile.projects[0].name == "Portfolio"
    assert profile.projects[0].technologies == "Next.js, TypeScript"
    # Ids and delivery metadata are ignored, never stored as content.
    assert "id" not in profile.experiences[0].model_dump()
    assert not hasattr(profile, "completion_percentage")
    assert not hasattr(profile, "has_unvalidated_changes")


def test_input_defaults_to_empty_sections():
    profile = CandidateProfile()

    assert profile.about is None
    assert profile.experiences == []
    assert profile.projects == []
    assert profile.skills == []


def test_input_accepts_null_sections():
    profile = CandidateProfile.model_validate(
        {"experiences": None, "projects": None, "skills": None}
    )

    assert profile.experiences == []
    assert profile.projects == []
    assert profile.skills == []


def test_output_wire_format_is_camel_case_and_canonical():
    result = NormalizedProfile(
        title="Senior Backend Engineer",
        summary="I build APIs.",
        years_of_experience=7,
        seniority="senior",
        target_role="Staff Engineer",
        location={"city": "Paris", "country": "FR"},
        experiences=[
            NormalizedExperience(
                position_title="Backend Engineer",
                company_name="Acme",
                start_date="2021-03",
                end_date=None,
            )
        ],
        languages=[
            NormalizedLanguage(name="English", level="C1", origin="declared"),
            NormalizedLanguage(
                name="German",
                level=None,
                origin="inferred",
                evidence=[SkillEvidence(source="experience", index=0)],
            ),
        ],
        diplomas=[
            NormalizedDiploma(
                title="MSc Computer Science",
                institution="Sorbonne",
                start_date="2016-09",
                end_date="2018-06",
                origin="declared",
            )
        ],
        certifications=[
            NormalizedCertification(name="AWS SAA", origin="declared"),
            NormalizedCertification(
                name="CKA",
                origin="inferred",
                evidence=[SkillEvidence(source="bio")],
            ),
        ],
        skills=[
            NormalizedSkill(
                name="Java",
                category="programming_language",
                level=4,
                level_source="declared",
                years_experience=7,
                origin="declared",
                evidence=[SkillEvidence(source="experience", index=0)],
            ),
            NormalizedSkill(
                name="Mentoring",
                category="soft_skill",
                origin="inferred",
                evidence=[SkillEvidence(source="bio")],
            ),
        ],
    )

    dumped = result.model_dump(by_alias=True)
    assert dumped["schemaVersion"] == SCHEMA_VERSION == "3"
    assert dumped["yearsOfExperience"] == 7
    assert dumped["seniority"] == "senior"
    assert dumped["targetRole"] == "Staff Engineer"
    assert dumped["location"]["city"] == "Paris"
    assert dumped["experiences"][0]["positionTitle"] == "Backend Engineer"
    assert dumped["experiences"][0]["startDate"] == "2021-03"
    assert "start_date" not in dumped["experiences"][0]
    assert dumped["skills"][0]["levelSource"] == "declared"
    assert dumped["skills"][0]["evidence"][0]["source"] == "experience"
    assert dumped["languages"][0]["origin"] == "declared"
    assert dumped["languages"][1]["evidence"][0] == {"source": "experience", "index": 0}
    assert dumped["diplomas"][0]["origin"] == "declared"
    assert dumped["certifications"][1]["evidence"][0] == {"source": "bio", "index": None}
    assert dumped["skills"][1]["evidence"][0] == {"source": "bio", "index": None}


def test_output_month_pattern_is_enforced():
    with pytest.raises(ValidationError):
        NormalizedExperience(
            position_title="Dev", company_name="Acme", start_date="2021-03-15"
        )


def test_output_years_of_experience_is_bounded():
    with pytest.raises(ValidationError):
        NormalizedProfile(years_of_experience=200)


def test_skill_category_is_constrained_to_the_taxonomy():
    with pytest.raises(ValidationError):
        NormalizedSkill(name="Java", category="n'importe quoi", origin="declared")


def test_skill_evidence_index_must_be_non_negative():
    with pytest.raises(ValidationError):
        SkillEvidence(source="experience", index=-1)


def test_bio_evidence_carries_no_index_and_other_sources_require_one():
    bio = SkillEvidence(source="bio")
    assert bio.source == "bio"
    assert bio.index is None
    with pytest.raises(ValidationError):
        SkillEvidence(source="experience")
    with pytest.raises(ValidationError):
        SkillEvidence(source="diploma", index=None)


def test_languages_diplomas_and_certifications_carry_their_origin():
    assert NormalizedLanguage(name="English", level="B2", origin="declared").origin == "declared"
    assert NormalizedDiploma(
        title="MSc CS", institution="Sorbonne", start_date="2016-09", origin="inferred"
    ).origin == "inferred"
    assert NormalizedCertification(name="AWS SAA", origin="declared").origin == "declared"
    with pytest.raises(ValidationError):
        NormalizedLanguage(name="English")
    with pytest.raises(ValidationError):
        NormalizedLanguage(name="English", origin="stored")
    with pytest.raises(ValidationError):
        NormalizedCertification(name="AWS SAA", origin="maybe")


def test_skill_level_source_and_origin_are_constrained():
    with pytest.raises(ValidationError):
        NormalizedSkill(name="Java", category="tool", origin="maybe")
    with pytest.raises(ValidationError):
        NormalizedSkill(name="Java", category="tool", origin="declared", level_source="guessed")


def test_project_context_is_constrained():
    with pytest.raises(ValidationError):
        NormalizedProfile().model_validate(
            {
                "projects": [
                    {
                        "name": "X",
                        "startDate": "2023-01",
                        "context": "unknown-context",
                    }
                ]
            }
        )


def test_normalize_request_parses_the_backend_body():
    request = NormalizeRequest.model_validate(
        {
            "profile": {"about": {"title": "Developer"}, "skills": []},
            "location": {"currentCity": "Paris", "currentCountry": "FR"},
            "context": {
                "languages": ["French"],
                "degrees": ["Bachelor's degree"],
                "studyFields": ["Computer Science"],
                "skills": {"Software": ["Microsoft Excel"]},
            },
        }
    )

    assert request.profile.about.title == "Developer"
    assert request.location.current_city == "Paris"
    assert request.context.study_fields == ["Computer Science"]


def test_normalize_request_accepts_a_missing_location_and_context():
    request = NormalizeRequest.model_validate({"profile": {}})

    assert request.location is None
    assert request.context is None


def test_json_schema_exposes_camel_case_fields():
    """The schema sent to the LLM and the wire format share one casing."""
    schema = NormalizedProfile.model_json_schema()

    assert "schemaVersion" in schema["properties"]
    assert "schema_version" not in schema["properties"]
    assert "yearsOfExperience" in schema["properties"]
    assert "seniority" in schema["properties"]
    assert "certifications" in schema["properties"]
    assert "projects" in schema["properties"]
    assert "startDate" in schema["$defs"]["NormalizedExperience"]["properties"]
    assert "levelSource" in schema["$defs"]["NormalizedSkill"]["properties"]
    assert "origin" in schema["$defs"]["NormalizedLanguage"]["properties"]
    assert "origin" in schema["$defs"]["NormalizedDiploma"]["properties"]
    assert "origin" in schema["$defs"]["NormalizedCertification"]["properties"]
    assert "index" in schema["$defs"]["SkillEvidence"]["properties"]
