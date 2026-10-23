"""Matching contract: request/analysis validation (camelCase wire format)."""

import pytest
from pydantic import ValidationError

from app.schemas.matching import (
    EVIDENCE_ARRAYS,
    SCHEMA_VERSION,
    ClarificationHistory,
    ClarificationQuestion,
    ClarificationSuggestion,
    CriterionAssessment,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingClarifyRequest,
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
    assert CriterionAssessment(
        criterion_key="a", score=100, rationale="r", evidence=[{"source": "bio"}]
    ).score == 100


def test_rationale_is_required():
    with pytest.raises(ValidationError):
        CriterionAssessment(criterion_key="a", score=50, rationale="", evidence=[{"source": "bio"}])


def test_bio_evidence_has_no_index_and_other_sources_need_one():
    assert MatchingEvidence(source="bio").index is None
    assert MatchingEvidence(source="experience", index=0).index == 0
    with pytest.raises(ValidationError, match="no index"):
        MatchingEvidence(source="bio", index=0)
    with pytest.raises(ValidationError, match="needs an index"):
        MatchingEvidence(source="skill")


def test_analysis_rejects_a_criterion_assessed_twice():
    twice = [
        {"criterionKey": "a", "score": 0, "rationale": "r"},
        {"criterionKey": "a", "score": 20, "rationale": "r", "evidence": [{"source": "bio"}]},
    ]
    with pytest.raises(ValidationError, match="exactly once"):
        MatchingAnalysis.model_validate({"assessments": twice})


def test_analysis_serializes_in_camel_case_with_its_schema_version():
    analysis = MatchingAnalysis.model_validate(
        {"assessments": [{"criterionKey": "a", "score": 0, "rationale": "Not shown."}]}
    )
    body = analysis.model_dump(by_alias=True)

    assert body["schemaVersion"] == SCHEMA_VERSION
    assert body["modelName"] is None
    assert body["assessments"][0] == {
        "criterionKey": "a",
        "score": 0,
        "rationale": "Not shown.",
        "evidence": [],
    }


@pytest.mark.parametrize("field", ["matchingId", "candidate", "offer", "criteria"])
def test_request_requires_every_context_field(field):
    body = _request()
    del body[field]
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(body)


@pytest.mark.parametrize("field", ["matchingId", "candidate", "offer", "criteria"])
def test_request_rejects_a_null_context_field(field):
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(**{field: None}))


def test_request_rejects_an_empty_matching_id():
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(matchingId=""))


@pytest.mark.parametrize(
    ("candidate", "offer"),
    [
        ({"schemaVersion": "2"}, {"schemaVersion": "2"}),
        ({}, {"schemaVersion": "2"}),
        ({"schemaVersion": "3"}, {"schemaVersion": "1"}),
        ({"schemaVersion": "3"}, {}),
    ],
)
def test_request_rejects_sheets_of_another_schema_version(candidate, offer):
    with pytest.raises(ValidationError, match="schemaVersion"):
        MatchingAnalyzeRequest.model_validate(_request(candidate=candidate, offer=offer))


@pytest.mark.parametrize("field", ["key", "label"])
def test_criterion_key_and_label_must_not_be_empty(field):
    criterion = {"key": "skill:java", "section": "required_skills", "label": "Java", field: ""}
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(criteria=[criterion]))


@pytest.mark.parametrize(
    "section", ["required_skills", "preferred_skills", "languages", "experience", "education"]
)
def test_request_accepts_each_section(section):
    criteria = [{"key": "k", "section": section, "label": "L"}]
    assert MatchingAnalyzeRequest.model_validate(_request(criteria=criteria)).criteria[0].section == section


def test_requirement_is_optional_and_left_out_of_the_payload_when_absent():
    request = MatchingAnalyzeRequest.model_validate(_request())

    dumped = [criterion.model_dump(by_alias=True, exclude_none=True) for criterion in request.criteria]

    assert dumped[0]["requirement"] == "level 4/5"
    assert "requirement" not in dumped[1]
    with_empty = MatchingAnalyzeRequest.model_validate(
        _request(criteria=[{"key": "k", "section": "languages", "label": "L", "requirement": ""}])
    )
    assert with_empty.criteria[0].requirement == ""


@pytest.mark.parametrize(
    "source", ["experience", "project", "diploma", "certification", "language", "skill"]
)
def test_each_indexed_source_is_accepted(source):
    assert MatchingEvidence(source=source, index=2).index == 2


def test_unknown_source_and_negative_index_are_rejected():
    with pytest.raises(ValidationError):
        MatchingEvidence(source="salary", index=0)
    with pytest.raises(ValidationError):
        MatchingEvidence(source="experience", index=-1)


def test_evidence_defaults_to_an_empty_list():
    assert CriterionAssessment(criterion_key="a", score=0, rationale="r").evidence == []


def test_a_zero_score_carries_no_evidence():
    with pytest.raises(ValidationError, match="score of 0 has no evidence"):
        CriterionAssessment(
            criterion_key="a", score=0, rationale="Not shown.", evidence=[{"source": "experience", "index": 0}]
        )
    assert CriterionAssessment(
        criterion_key="a", score=1, rationale="Barely.", evidence=[{"source": "bio"}]
    ).evidence[0].source == "bio"


def test_a_non_integer_score_is_rejected_but_an_integral_string_is_coerced():
    with pytest.raises(ValidationError):
        CriterionAssessment(criterion_key="a", score=50.5, rationale="r", evidence=[{"source": "bio"}])
    assert CriterionAssessment.model_validate(
        {"criterionKey": "a", "score": "50", "rationale": "r", "evidence": [{"source": "bio"}]}
    ).score == 50


def test_analysis_requires_its_assessments_but_accepts_an_empty_list():
    with pytest.raises(ValidationError):
        MatchingAnalysis.model_validate({})
    # Coverage (one assessment per criterion) is checked by the pipeline, not the schema.
    assert MatchingAnalysis.model_validate({"assessments": []}).assessments == []


def test_analysis_serializes_the_policy_version_in_camel_case():
    body = MatchingAnalysis(policy_version="generic-1", assessments=[]).model_dump(by_alias=True)

    assert body["policyVersion"] == "generic-1"
    assert "policy_version" not in body


def test_analysis_serializes_the_model_name_in_camel_case():
    body = MatchingAnalysis(model_name="gemini-test", assessments=[]).model_dump(by_alias=True)

    assert body["modelName"] == "gemini-test"
    assert "model_name" not in body


# --- T-62/T-63: evidence discipline, clarifications, clarify contract ---------


def test_a_positive_score_needs_at_least_one_evidence():
    with pytest.raises(ValidationError, match="score above 0 needs at least one evidence"):
        CriterionAssessment(criterion_key="a", score=1, rationale="Barely.")
    with pytest.raises(ValidationError, match="score above 0 needs at least one evidence"):
        CriterionAssessment(criterion_key="a", score=100, rationale="Shown.", evidence=[])


def test_a_null_evidence_list_is_rejected():
    with pytest.raises(ValidationError):
        CriterionAssessment.model_validate({"criterionKey": "a", "score": 0, "rationale": "r", "evidence": None})


def test_a_positive_score_with_evidence_and_a_zero_score_without_are_valid():
    positive = CriterionAssessment(criterion_key="a", score=100, rationale="r", evidence=[{"source": "skill", "index": 0}])
    assert positive.evidence[0].source == "skill"
    assert CriterionAssessment(criterion_key="a", score=0, rationale="r", evidence=[]).evidence == []


def test_clarification_evidence_needs_an_index():
    assert MatchingEvidence(source="clarification", index=0).index == 0
    with pytest.raises(ValidationError, match="'clarification' evidence needs an index"):
        MatchingEvidence(source="clarification")
    with pytest.raises(ValidationError, match="needs an index"):
        MatchingEvidence.model_validate({"source": "clarification", "index": None})
    with pytest.raises(ValidationError):
        MatchingEvidence(source="clarification", index=-1)


def test_clarification_is_not_a_sheet_array():
    # Checked against the request clarifications, never against the candidate sheet.
    assert "clarification" not in EVIDENCE_ARRAYS


def _clarification(**overrides):
    body = {"question": "Q?", "rationale": "Why.", "answer": "A.", "status": "answered"}
    body.update(overrides)
    return body


def test_clarification_history_reads_the_camel_case_wire_format():
    history = ClarificationHistory.model_validate(_clarification())
    assert (history.question, history.rationale, history.answer, history.status) == ("Q?", "Why.", "A.", "answered")

    skipped = ClarificationHistory.model_validate({"question": "Q?", "status": "skipped"})
    assert skipped.rationale is None and skipped.answer is None


@pytest.mark.parametrize("answer", [None, "", "   "])
def test_an_answered_clarification_needs_a_non_empty_answer(answer):
    with pytest.raises(ValidationError, match="answered clarification needs a non-empty answer"):
        ClarificationHistory.model_validate(_clarification(answer=answer))


@pytest.mark.parametrize("answer", ["Some text", ""])
def test_a_skipped_clarification_carries_no_answer(answer):
    with pytest.raises(ValidationError, match="skipped clarification has no answer"):
        ClarificationHistory.model_validate(_clarification(status="skipped", answer=answer))


@pytest.mark.parametrize("status", ["open", "", None])
def test_clarification_status_is_answered_or_skipped(status):
    with pytest.raises(ValidationError):
        ClarificationHistory.model_validate(_clarification(status=status))


@pytest.mark.parametrize("field", ["question", "status"])
def test_clarification_question_and_status_are_required(field):
    body = _clarification()
    del body[field]
    with pytest.raises(ValidationError):
        ClarificationHistory.model_validate(body)


def test_clarification_question_must_not_be_empty():
    with pytest.raises(ValidationError):
        ClarificationHistory.model_validate(_clarification(question=""))


def test_analyze_request_defaults_to_no_previous_assessment_and_no_clarification():
    request = MatchingAnalyzeRequest.model_validate(_request())

    assert request.previous_assessments == []
    assert request.clarifications == []


def test_analyze_request_reads_previous_assessments_and_clarifications():
    request = MatchingAnalyzeRequest.model_validate(
        _request(
            previousAssessments=[
                {"criterionKey": "skill:java", "score": 70, "rationale": "r", "evidence": [{"source": "bio"}]},
                {"criterionKey": "experience:total", "score": 0, "rationale": "r"},
            ],
            clarifications=[_clarification(), {"question": "Q2?", "status": "skipped"}],
        )
    )

    assert [assessment.score for assessment in request.previous_assessments] == [70, 0]
    assert [clarification.status for clarification in request.clarifications] == ["answered", "skipped"]


@pytest.mark.parametrize("field", ["previousAssessments", "clarifications"])
def test_analyze_request_rejects_a_null_history(field):
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(**{field: None}))


def test_analyze_request_rejects_an_invalid_previous_assessment():
    with pytest.raises(ValidationError, match="score above 0"):
        MatchingAnalyzeRequest.model_validate(
            _request(previousAssessments=[{"criterionKey": "skill:java", "score": 70, "rationale": "r"}])
        )


def test_analyze_request_rejects_an_invalid_clarification():
    with pytest.raises(ValidationError):
        MatchingAnalyzeRequest.model_validate(_request(clarifications=[_clarification(status="open")]))


@pytest.mark.parametrize(("field", "limit"), [("question", 400), ("rationale", 600)])
def test_clarification_question_texts_are_bounded(field, limit):
    base = {"question": "Q?", "rationale": "Why."}
    assert len(getattr(ClarificationQuestion(**{**base, field: "x"}), field)) == 1
    assert len(getattr(ClarificationQuestion(**{**base, field: "x" * limit}), field)) == limit
    with pytest.raises(ValidationError):
        ClarificationQuestion(**{**base, field: "x" * (limit + 1)})
    with pytest.raises(ValidationError):
        ClarificationQuestion(**{**base, field: ""})
    with pytest.raises(ValidationError):
        ClarificationQuestion.model_validate({key: value for key, value in base.items() if key != field})


def test_clarification_suggestion_is_a_question_or_null():
    assert ClarificationSuggestion().question is None
    assert ClarificationSuggestion.model_validate({"question": None}).model_dump(by_alias=True) == {"question": None}
    suggestion = ClarificationSuggestion.model_validate({"question": {"question": "Q?", "rationale": "Why."}})
    assert suggestion.model_dump(by_alias=True) == {"question": {"question": "Q?", "rationale": "Why."}}
    with pytest.raises(ValidationError):
        ClarificationSuggestion.model_validate({"question": "Q?"})


def _clarify(**overrides):
    body = {
        **_request(),
        "assessments": [
            {"criterionKey": "skill:java", "score": 70, "rationale": "r", "evidence": [{"source": "skill", "index": 0}]},
            {"criterionKey": "experience:total", "score": 0, "rationale": "r"},
        ],
        "clarifications": [_clarification()],
        "remainingQuestions": 2,
    }
    body.update(overrides)
    return body


def test_clarify_request_reads_the_camel_case_wire_format():
    request = MatchingClarifyRequest.model_validate(_clarify())

    assert request.matching_id == "m-1"
    assert [assessment.criterion_key for assessment in request.assessments] == ["skill:java", "experience:total"]
    assert request.clarifications[0].answer == "A."
    assert request.remaining_questions == 2


def test_clarify_request_defaults_to_no_clarification():
    body = _clarify()
    del body["clarifications"]
    assert MatchingClarifyRequest.model_validate(body).clarifications == []


@pytest.mark.parametrize("remaining", [0, 10])
def test_remaining_questions_bounds_are_inclusive(remaining):
    assert MatchingClarifyRequest.model_validate(_clarify(remainingQuestions=remaining)).remaining_questions == remaining


@pytest.mark.parametrize("remaining", [-1, 11, None, "two"])
def test_remaining_questions_is_bounded_and_not_null(remaining):
    with pytest.raises(ValidationError):
        MatchingClarifyRequest.model_validate(_clarify(remainingQuestions=remaining))


@pytest.mark.parametrize("field", ["matchingId", "candidate", "offer", "criteria", "assessments", "remainingQuestions"])
def test_clarify_request_requires_every_context_field(field):
    body = _clarify()
    del body[field]
    with pytest.raises(ValidationError):
        MatchingClarifyRequest.model_validate(body)


@pytest.mark.parametrize("field", ["assessments", "clarifications"])
def test_clarify_request_rejects_a_null_list(field):
    with pytest.raises(ValidationError):
        MatchingClarifyRequest.model_validate(_clarify(**{field: None}))


def test_clarify_request_rejects_a_missing_assessment():
    body = _clarify()
    body["assessments"] = body["assessments"][:1]
    with pytest.raises(ValidationError, match="cover exactly the criteria"):
        MatchingClarifyRequest.model_validate(body)


def test_clarify_request_rejects_an_assessment_of_an_unknown_criterion():
    body = _clarify()
    body["assessments"].append({"criterionKey": "skill:cobol", "score": 0, "rationale": "r"})
    with pytest.raises(ValidationError, match="cover exactly the criteria"):
        MatchingClarifyRequest.model_validate(body)


def test_clarify_request_rejects_a_criterion_assessed_twice():
    body = _clarify()
    body["assessments"].append({"criterionKey": "experience:total", "score": 0, "rationale": "again"})
    with pytest.raises(ValidationError, match="exactly once"):
        MatchingClarifyRequest.model_validate(body)


def test_clarify_request_rejects_an_invalid_assessment():
    body = _clarify()
    body["assessments"][1] = {"criterionKey": "experience:total", "score": 40, "rationale": "r"}
    with pytest.raises(ValidationError, match="score above 0"):
        MatchingClarifyRequest.model_validate(body)


def test_clarify_request_accepts_empty_criteria_with_empty_assessments():
    # Emptiness is a business error of the pipeline (422), not a schema error.
    request = MatchingClarifyRequest.model_validate(_clarify(criteria=[], assessments=[]))
    assert request.criteria == [] and request.assessments == []


def test_clarify_request_rejects_duplicate_criterion_keys():
    criterion = {"key": "skill:java", "section": "required_skills", "label": "Java"}
    with pytest.raises(ValidationError, match="unique"):
        MatchingClarifyRequest.model_validate(_clarify(criteria=[criterion, criterion]))


@pytest.mark.parametrize(
    ("candidate", "offer"),
    [
        ({"schemaVersion": "2"}, {"schemaVersion": "2"}),
        ({}, {"schemaVersion": "2"}),
        ({"schemaVersion": "3"}, {"schemaVersion": "1"}),
        ({"schemaVersion": "3"}, {}),
    ],
)
def test_clarify_request_rejects_sheets_of_another_schema_version(candidate, offer):
    with pytest.raises(ValidationError, match="schemaVersion"):
        MatchingClarifyRequest.model_validate(_clarify(candidate=candidate, offer=offer))


def test_clarify_request_rejects_an_empty_matching_id():
    with pytest.raises(ValidationError):
        MatchingClarifyRequest.model_validate(_clarify(matchingId=""))
