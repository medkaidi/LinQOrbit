"""Matching contract: request/analysis validation (camelCase wire format)."""

import pytest
from pydantic import ValidationError

from app.schemas.matching import (
    SCHEMA_VERSION,
    CriterionAssessment,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingEvidence,
)


def _request(**overrides):
    body = {
        "matchingId": "m-1",
        "candidate": {"schemaVersion": "3", "skills": []},
        "offer": {"schemaVersion": "2", "requiredSkills": []},
        "criteria": [
            {"key": "skill:java", "section": "required_skills", "label": "Java", "requirement": "level 4/5"},
            {"key": "experience:total", "section": "experience", "label": "Relevant experience"},
        ],
    }
    body.update(overrides)
    return body


def test_request_reads_the_camel_case_wire_format():
    request = MatchingAnalyzeRequest.model_validate(_request())

    assert request.matching_id == "m-1"
    assert [criterion.key for criterion in request.criteria] == ["skill:java", "experience:total"]
    assert request.criteria[1].requirement is None
    assert request.offer == {"schemaVersion": "2", "requiredSkills": []}


def test_request_rejects_duplicate_criterion_keys():
    duplicated = [
        {"key": "skill:java", "section": "required_skills", "label": "Java"},
        {"key": "skill:java", "section": "preferred_skills", "label": "Java"},
    ]
    with pytest.raises(ValidationError, match="unique"):
        MatchingAnalyzeRequest.model_validate(_request(criteria=duplicated))


def test_request_rejects_an_unknown_section():
    criteria = [{"key": "x", "section": "salary", "label": "Salary"}]
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(criteria=criteria))


def test_request_accepts_an_empty_criteria_list():
    # Emptiness is a business error of the pipeline (422), not a schema error.
    assert MatchingAnalyzeRequest.model_validate(_request(criteria=[])).criteria == []


@pytest.mark.parametrize("score", [-1, 101])
def test_score_is_bounded(score):
    with pytest.raises(ValidationError):
        CriterionAssessment(criterion_key="skill:java", score=score, rationale="r")


def test_score_bounds_are_inclusive():
    assert CriterionAssessment(criterion_key="a", score=0, rationale="r").score == 0
    assert CriterionAssessment(criterion_key="a", score=100, rationale="r").score == 100


def test_rationale_is_required():
    with pytest.raises(ValidationError):
        CriterionAssessment(criterion_key="a", score=50, rationale="")


def test_bio_evidence_has_no_index_and_other_sources_need_one():
    assert MatchingEvidence(source="bio").index is None
    assert MatchingEvidence(source="experience", index=0).index == 0
    with pytest.raises(ValidationError, match="no index"):
        MatchingEvidence(source="bio", index=0)
    with pytest.raises(ValidationError, match="needs an index"):
        MatchingEvidence(source="skill")


def test_analysis_rejects_a_criterion_assessed_twice():
    twice = [
        {"criterionKey": "a", "score": 10, "rationale": "r"},
        {"criterionKey": "a", "score": 20, "rationale": "r"},
    ]
    with pytest.raises(ValidationError, match="exactly once"):
        MatchingAnalysis.model_validate({"assessments": twice})


def test_analysis_serializes_in_camel_case_with_its_schema_version():
    analysis = MatchingAnalysis.model_validate(
        {"assessments": [{"criterionKey": "a", "score": 0, "rationale": "Not shown."}]}
    )
    body = analysis.model_dump(by_alias=True)

    assert body["schemaVersion"] == SCHEMA_VERSION
    assert body["assessments"][0] == {
        "criterionKey": "a",
        "score": 0,
        "rationale": "Not shown.",
        "evidence": [],
    }
