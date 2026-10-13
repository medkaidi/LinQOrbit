"""Validation tests for the job offer normalization contract (no LLM involved)."""

import pytest
from pydantic import ValidationError

from app.schemas.job_offer import (
    SCHEMA_VERSION,
    JobOfferLanguageRequirement,
    JobOfferNormalizeRequest,
    JobOfferSnapshot,
    NormalizedJobOffer,
    NormalizedResponsibility,
    OfferSkillEvidence,
    OfferSkillRequirement,
)


def test_input_payload_parses_the_backend_wire_format():
    """Spring Boot sends camelCase, resolved labels and plain-text description."""
    offer = JobOfferSnapshot.model_validate(
        {
            "id": "3f0c1c9e-0000-0000-0000-000000000001",
            "title": "Senior Backend Engineer",
            "description": "You will own the public API.",
            "seniority": "senior",
            "requiredExpYear": 3,
            "city": "Paris",
            "country": "FR",
            "contractTypeLabel": "Permanent",
            "employmentTypeLabel": "Full-time",
            "workModeLabel": "Hybrid",
            "salaryMin": 60000,
            "salaryMax": 75000,
            "salaryCurrency": "EUR",
            "salaryPeriod": "year",
            "company": {"name": "Acme", "description": "We build payments."},
            "skills": [
                {
                    "skillId": "3f0c1c9e-0000-0000-0000-000000000005",
                    "name": "Java",
                    "requirementType": "mandatory",
                    "weight": 5,
                    "yearsExperience": 3,
                }
            ],
            "languages": [
                {
                    "languageId": "3f0c1c9e-0000-0000-0000-000000000006",
                    "name": "English",
                    "level": "B2",
                    "isRequired": True,
                }
            ],
            "degreeLabels": ["Master"],
            "studyFieldLabels": ["Computer Science"],
            "status": "VALIDATED",
            "hasUnvalidatedChanges": False,
        }
    )

    assert offer.title == "Senior Backend Engineer"
    assert offer.description == "You will own the public API."
    assert offer.contract_type_label == "Permanent"
    assert offer.company.name == "Acme"
    assert offer.skills[0].requirement_type == "mandatory"
    assert offer.languages[0].is_required is True
    # Ids and delivery metadata are ignored, never stored as content.
    assert "id" not in offer.model_dump()
    assert not hasattr(offer, "status")
    assert not hasattr(offer, "has_unvalidated_changes")


def test_input_defaults_to_empty_sections():
    offer = JobOfferSnapshot()

    assert offer.title is None
    assert offer.company is None
    assert offer.skills == []
    assert offer.languages == []
    assert offer.degree_labels == []
    assert offer.study_field_labels == []


def test_input_accepts_null_sections():
    offer = JobOfferSnapshot.model_validate(
        {"skills": None, "languages": None, "degreeLabels": None, "studyFieldLabels": None}
    )

    assert offer.skills == []
    assert offer.languages == []
    assert offer.degree_labels == []
    assert offer.study_field_labels == []


def test_output_wire_format_is_camel_case_and_canonical():
    result = NormalizedJobOffer(
        title="Senior Backend Engineer",
        summary="Own our public API and its on-call rotation.",
        contract_type="permanent",
        work_time="full_time",
        seniority="senior",
        work_mode="hybrid",
        location={"city": "Paris", "country": "FR"},
        responsibilities=[
            NormalizedResponsibility(
                text="Own the public API",
                importance="mandatory",
                technologies=["Java", "PostgreSQL"],
            )
        ],
        required_skills=[
            OfferSkillRequirement(
                name="Java",
                category="programming_language",
                level=4,
                level_source="declared",
                min_years=3,
                origin="declared",
                evidence=[OfferSkillEvidence(source="responsibility", index=0)],
            )
        ],
        preferred_skills=[
            OfferSkillRequirement(
                name="Kubernetes",
                category="tool",
                origin="inferred",
            )
        ],
    )

    dumped = result.model_dump(by_alias=True)
    assert dumped["schemaVersion"] == SCHEMA_VERSION == "1"
    assert dumped["contractType"] == "permanent"
    assert dumped["workTime"] == "full_time"
    assert dumped["workMode"] == "hybrid"
    assert dumped["location"]["city"] == "Paris"
    assert dumped["responsibilities"][0]["importance"] == "mandatory"
    assert dumped["responsibilities"][0]["technologies"] == ["Java", "PostgreSQL"]
    assert dumped["requiredSkills"][0]["minYears"] == 3
    assert dumped["requiredSkills"][0]["levelSource"] == "declared"
    assert dumped["requiredSkills"][0]["evidence"][0]["source"] == "responsibility"
    assert dumped["preferredSkills"][0]["origin"] == "inferred"
    assert "required_skills" not in dumped


def test_output_enums_are_constrained():
    with pytest.raises(ValidationError):
        NormalizedJobOffer(contract_type="CDI")
    with pytest.raises(ValidationError):
        NormalizedJobOffer(work_time="Full-time")
    with pytest.raises(ValidationError):
        NormalizedJobOffer(work_mode="sometimes-remote")
    with pytest.raises(ValidationError):
        NormalizedResponsibility(text="Own the API", importance="must_have")


def test_language_level_is_constrained_to_cefr():
    """Mirror of the candidate sheet: free text would break language comparison."""
    assert JobOfferLanguageRequirement(name="English", level="B2").level == "B2"
    assert JobOfferLanguageRequirement(name="English").level is None
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", level="B2+")
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", level="Fluent")


def test_output_skill_category_and_discipline_are_constrained():
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="n'importe quoi", origin="declared")
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", origin="maybe")
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="tool", origin="declared", level_source="guessed"
        )


def test_output_skill_level_and_min_years_are_bounded():
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", origin="declared", level=9)
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", origin="declared", min_years=99)


def test_output_evidence_index_must_be_non_negative():
    with pytest.raises(ValidationError):
        OfferSkillEvidence(source="responsibility", index=-1)


def test_output_evidence_source_is_responsibility_only():
    with pytest.raises(ValidationError):
        NormalizedJobOffer().model_validate(
            {
                "requiredSkills": [
                    {
                        "name": "Java",
                        "category": "programming_language",
                        "origin": "declared",
                        "evidence": [{"source": "experience", "index": 0}],
                    }
                ]
            }
        )


def test_input_salary_numbers_pass_through():
    offer = JobOfferSnapshot.model_validate(
        {"salaryMin": 60000, "salaryMax": 75000, "salaryCurrency": "EUR", "salaryPeriod": "year"}
    )

    assert offer.salary_min == 60000
    assert offer.salary_max == 75000

    dumped = NormalizedJobOffer(
        salary={"min": 60000.0, "max": 75000.0, "currency": "EUR", "period": "year"}
    ).model_dump(by_alias=True)
    assert dumped["salary"] == {"min": 60000.0, "max": 75000.0, "currency": "EUR", "period": "year"}


def test_request_parses_the_backend_body():
    request = JobOfferNormalizeRequest.model_validate(
        {
            "offer": {"title": "Backend Engineer", "skills": []},
            "context": {
                "languages": ["French"],
                "skills": {"Software": ["Microsoft Excel"]},
            },
        }
    )

    assert request.offer.title == "Backend Engineer"
    assert request.context.skills == {"Software": ["Microsoft Excel"]}


def test_request_accepts_a_missing_context():
    request = JobOfferNormalizeRequest.model_validate({"offer": {}})

    assert request.context is None


def test_json_schema_exposes_camel_case_fields():
    """The schema sent to the LLM and the wire format share one casing."""
    schema = NormalizedJobOffer.model_json_schema()

    assert "schemaVersion" in schema["properties"]
    assert "schema_version" not in schema["properties"]
    assert "contractType" in schema["properties"]
    assert "workTime" in schema["properties"]
    assert "workMode" in schema["properties"]
    assert "requiredSkills" in schema["properties"]
    assert "preferredSkills" in schema["properties"]
    assert "importance" in schema["$defs"]["NormalizedResponsibility"]["properties"]
    assert "minYears" in schema["$defs"]["OfferSkillRequirement"]["properties"]
