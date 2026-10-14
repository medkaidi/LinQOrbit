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
    OfferCertification,
    OfferRequirementEntry,
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
    assert offer.skills[0].weight == 5
    assert offer.languages[0].is_required is True
    # v2: the criteria Spring always sent are content now, not dead payload.
    assert offer.required_exp_year == 3
    assert offer.degree_labels == ["Master"]
    assert offer.study_field_labels == ["Computer Science"]
    # Ids and delivery metadata stay ignored.
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
        required_years=5,
        required_years_source="inferred",
        required_degrees=[OfferRequirementEntry(label="Master's degree", source="inferred")],
        required_study_fields=[OfferRequirementEntry(label="Computer Science", source="declared")],
        languages=[JobOfferLanguageRequirement(name="English", level="B2", origin="declared")],
        responsibilities=[
            NormalizedResponsibility(
                text="Own the public API",
                importance="mandatory",
                weight=5,
                technologies=["Java", "PostgreSQL"],
            )
        ],
        required_skills=[
            OfferSkillRequirement(
                name="Java",
                category="programming_language",
                weight=5,
                level=4,
                level_source="declared",
                min_years=3,
                min_years_source="declared",
                origin="declared",
                evidence=[OfferSkillEvidence(source="responsibility", index=0)],
            )
        ],
        preferred_skills=[
            OfferSkillRequirement(
                name="Kubernetes",
                category="tool",
                weight=2,
                origin="inferred",
            )
        ],
        certifications=[OfferCertification(name="AWS Solutions Architect")],
    )

    dumped = result.model_dump(by_alias=True)
    assert dumped["schemaVersion"] == SCHEMA_VERSION == "2"
    assert dumped["contractType"] == "permanent"
    assert dumped["workTime"] == "full_time"
    assert dumped["workMode"] == "hybrid"
    assert dumped["location"]["city"] == "Paris"
    assert dumped["requiredYears"] == 5
    assert dumped["requiredYearsSource"] == "inferred"
    assert dumped["requiredDegrees"][0] == {"label": "Master's degree", "source": "inferred"}
    assert dumped["requiredStudyFields"][0] == {"label": "Computer Science", "source": "declared"}
    assert dumped["languages"][0]["origin"] == "declared"
    assert dumped["responsibilities"][0]["importance"] == "mandatory"
    assert dumped["responsibilities"][0]["weight"] == 5
    assert dumped["responsibilities"][0]["technologies"] == ["Java", "PostgreSQL"]
    assert dumped["requiredSkills"][0]["weight"] == 5
    assert dumped["requiredSkills"][0]["minYears"] == 3
    assert dumped["requiredSkills"][0]["minYearsSource"] == "declared"
    assert dumped["requiredSkills"][0]["levelSource"] == "declared"
    assert dumped["requiredSkills"][0]["evidence"][0]["source"] == "responsibility"
    assert dumped["preferredSkills"][0]["weight"] == 2
    assert dumped["preferredSkills"][0]["origin"] == "inferred"
    assert dumped["certifications"][0]["name"] == "AWS Solutions Architect"
    assert "required_skills" not in dumped


def test_output_enums_are_constrained():
    with pytest.raises(ValidationError):
        NormalizedJobOffer(contract_type="CDI")
    with pytest.raises(ValidationError):
        NormalizedJobOffer(work_time="Full-time")
    with pytest.raises(ValidationError):
        NormalizedJobOffer(work_mode="sometimes-remote")
    with pytest.raises(ValidationError):
        NormalizedResponsibility(text="Own the API", importance="must_have", weight=3)


def test_weight_is_always_present_and_bounded():
    """Every criterion carries a 1-5 weight: declared copy or judged centrality."""
    assert NormalizedResponsibility(text="Own the API", importance="mandatory", weight=1)
    assert OfferSkillRequirement(name="Java", category="tool", weight=5, origin="declared")
    with pytest.raises(ValidationError):
        NormalizedResponsibility(text="Own the API", importance="mandatory")
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", origin="declared")
    with pytest.raises(ValidationError):
        NormalizedResponsibility(text="Own the API", importance="mandatory", weight=0)
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", weight=6, origin="declared")


def test_required_years_and_source_are_constrained():
    offer = NormalizedJobOffer(required_years=5, required_years_source="inferred")

    assert offer.required_years == 5
    with pytest.raises(ValidationError):
        NormalizedJobOffer(required_years=99)
    with pytest.raises(ValidationError):
        NormalizedJobOffer(required_years_source="guessed")


def test_requirement_entries_carry_their_provenance():
    entry = OfferRequirementEntry(label="Master's degree", source="declared")

    assert entry.source == "declared"
    with pytest.raises(ValidationError):
        OfferRequirementEntry(label="Master's degree", source="maybe")


def test_certifications_are_dated_when_stated():
    cert = OfferCertification(name="AWS SAA", issuer="Amazon", issued_at="2024-05")

    assert cert.issued_at == "2024-05"
    with pytest.raises(ValidationError):
        OfferCertification(name="AWS SAA", issued_at="May 2024")


def test_language_level_is_constrained_to_cefr():
    """Mirror of the candidate sheet: free text would break language comparison."""
    assert JobOfferLanguageRequirement(name="English", level="B2", origin="declared").level == "B2"
    assert JobOfferLanguageRequirement(name="English", origin="inferred").level is None
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", level="B2+", origin="declared")
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", level="Fluent", origin="declared")


def test_language_origin_is_required_and_constrained():
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", level="B2")
    with pytest.raises(ValidationError):
        JobOfferLanguageRequirement(name="English", origin="stored")


def test_output_skill_category_and_discipline_are_constrained():
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="n'importe quoi", weight=3, origin="declared"
        )
    with pytest.raises(ValidationError):
        OfferSkillRequirement(name="Java", category="tool", weight=3, origin="maybe")
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="tool", weight=3, origin="declared", level_source="guessed"
        )
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="tool", weight=3, origin="declared", min_years_source="guessed"
        )


def test_output_skill_level_and_min_years_are_bounded():
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="tool", weight=3, origin="declared", level=9
        )
    with pytest.raises(ValidationError):
        OfferSkillRequirement(
            name="Java", category="tool", weight=3, origin="declared", min_years=99
        )


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
                        "weight": 5,
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
    assert "requiredYears" in schema["properties"]
    assert "requiredDegrees" in schema["properties"]
    assert "requiredStudyFields" in schema["properties"]
    assert "certifications" in schema["properties"]
    assert "requiredSkills" in schema["properties"]
    assert "preferredSkills" in schema["properties"]
    assert "weight" in schema["$defs"]["NormalizedResponsibility"]["properties"]
    assert "weight" in schema["$defs"]["OfferSkillRequirement"]["properties"]
    assert "minYearsSource" in schema["$defs"]["OfferSkillRequirement"]["properties"]
    assert "origin" in schema["$defs"]["JobOfferLanguageRequirement"]["properties"]
    assert "source" in schema["$defs"]["OfferRequirementEntry"]["properties"]
