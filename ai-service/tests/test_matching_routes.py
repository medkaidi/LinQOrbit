"""Matching routes: validation, camelCase output and error mapping. The pipelines are stubbed (no LLM)."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.agents.matching_analyze import MatchingAnalyzeError
from app.agents.matching_clarify import MatchingClarifyError
from app.main import app
from app.schemas.matching import (
    ClarificationSuggestion,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingClarifyRequest,
)

client = TestClient(app)
# Unhandled errors become the generic 500 instead of being re-raised into the test.
lenient_client = TestClient(app, raise_server_exceptions=False)

BODY = {
    "matchingId": "m-1",
    "candidate": {"schemaVersion": "3"},
    "offer": {"schemaVersion": "2"},
    "criteria": [{"key": "skill:java", "section": "required_skills", "label": "Java"}],
}


def test_returns_the_scores_in_camel_case(monkeypatch):
    received = {}

    def fake_analyze(request: MatchingAnalyzeRequest) -> MatchingAnalysis:
        received["request"] = request
        return MatchingAnalysis(
            schema_version="1",
            policy_version="generic-1",
            assessments=[
                {"criterion_key": "skill:java", "score": 80, "rationale": "Shown.", "evidence": [{"source": "bio"}]}
            ],
        )

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", fake_analyze)

    response = client.post("/matching/analyze", json=BODY)

    assert response.status_code == 200
    body = response.json()
    assert body["policyVersion"] == "generic-1"
    assert body["assessments"][0]["criterionKey"] == "skill:java"
    assert "criterion_key" not in body["assessments"][0]
    assert received["request"].matching_id == "m-1"


def test_rejects_a_malformed_request_with_422():
    response = client.post("/matching/analyze", json={"matchingId": "m-1"})

    assert response.status_code == 422


@pytest.mark.parametrize(("code", "status"), [("empty_criteria", 422), ("no_output", 502), ("unknown", 500)])
def test_maps_pipeline_errors_to_http_statuses(monkeypatch, code, status):
    def failing(_request):
        raise MatchingAnalyzeError(code, "Safe message.")

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", failing)

    response = client.post("/matching/analyze", json=BODY)

    assert response.status_code == status
    assert response.json()["detail"] == "Safe message."


def test_empty_criteria_through_the_real_pipeline_is_a_422_with_the_business_message():
    response = client.post("/matching/analyze", json={**BODY, "criteria": []})

    assert response.status_code == 422
    assert response.json()["detail"] == "The matching has no criterion to score."


def test_duplicate_criterion_keys_are_a_validation_422():
    criterion = {"key": "skill:java", "section": "required_skills", "label": "Java"}

    response = client.post("/matching/analyze", json={**BODY, "criteria": [criterion, criterion]})

    assert response.status_code == 422


@pytest.mark.parametrize("field", ["candidate", "offer", "criteria"])
def test_an_incomplete_body_is_a_validation_422(field):
    body = {key: value for key, value in BODY.items() if key != field}

    assert client.post("/matching/analyze", json=body).status_code == 422


def test_serializes_the_whole_contract_in_camel_case(monkeypatch):
    def fake_analyze(_request):
        return MatchingAnalysis(
            schema_version="1",
            policy_version="generic-1",
            assessments=[
                {
                    "criterion_key": "skill:java",
                    "score": 80,
                    "rationale": "Shown.",
                    "evidence": [{"source": "experience", "index": 0}, {"source": "bio"}],
                }
            ],
        )

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", fake_analyze)

    body = client.post("/matching/analyze", json=BODY).json()

    assert body == {
        "schemaVersion": "1",
        "policyVersion": "generic-1",
        "assessments": [
            {
                "criterionKey": "skill:java",
                "score": 80,
                "rationale": "Shown.",
                "evidence": [{"source": "experience", "index": 0}, {"source": "bio", "index": None}],
            }
        ],
    }


def test_echoes_the_request_id_on_a_502(monkeypatch):
    def failing(_request):
        raise MatchingAnalyzeError("no_output", "Safe message.")

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", failing)

    response = client.post("/matching/analyze", json=BODY, headers={"X-Request-Id": "job-123"})

    assert response.status_code == 502
    assert response.headers["X-Request-Id"] == "job-123"


def test_a_provider_failure_is_a_generic_500_for_now(monkeypatch):
    # Current behaviour, shared by every pipeline (debt opened: 502 would suit the worker better).
    def provider_down(_request):
        raise TimeoutError("Gemini timed out")

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", provider_down)

    response = lenient_client.post("/matching/analyze", json=BODY)

    assert response.status_code == 500
    assert "Gemini" not in response.text


# --- /matching/analyze: re-evaluation context (T-63) --------------------------

ANSWERED = {"question": "Java backend?", "rationale": "Why.", "answer": "SECRET-ANSWER", "status": "answered"}
SKIPPED = {"question": "Kubernetes?", "status": "skipped"}


def test_analyze_accepts_previous_assessments_and_clarifications(monkeypatch):
    received = {}

    def fake_analyze(request):
        received["request"] = request
        return MatchingAnalysis(assessments=[{"criterion_key": "skill:java", "score": 0, "rationale": "r"}])

    monkeypatch.setattr("app.api.routes.matching.analyze_matching", fake_analyze)
    body = {
        **BODY,
        "previousAssessments": [
            {"criterionKey": "skill:java", "score": 60, "rationale": "r", "evidence": [{"source": "skill", "index": 0}]}
        ],
        "clarifications": [ANSWERED, SKIPPED],
    }

    assert client.post("/matching/analyze", json=body).status_code == 200
    assert received["request"].previous_assessments[0].score == 60
    assert [clarification.status for clarification in received["request"].clarifications] == ["answered", "skipped"]


@pytest.mark.parametrize(
    "override",
    [
        {"previousAssessments": [{"criterionKey": "skill:java", "score": 60, "rationale": "r"}]},
        {"clarifications": [{"question": "Q?", "status": "answered"}]},
        {"clarifications": [{"question": "Q?", "answer": "A", "status": "skipped"}]},
        {"clarifications": None},
    ],
)
def test_analyze_rejects_an_invalid_history_with_422(override):
    assert client.post("/matching/analyze", json={**BODY, **override}).status_code == 422


# --- /matching/clarify (T-62) --------------------------------------------------

CLARIFY_BODY = {
    **BODY,
    "assessments": [{"criterionKey": "skill:java", "score": 0, "rationale": "Not shown."}],
    "clarifications": [ANSWERED, SKIPPED],
    "remainingQuestions": 2,
}


def _question() -> ClarificationSuggestion:
    return ClarificationSuggestion(
        question={"question": "Could you describe your Java work?", "rationale": "Java is required for this offer."}
    )


def test_clarify_returns_the_question_in_camel_case(monkeypatch):
    received = {}

    def fake_clarify(request: MatchingClarifyRequest) -> ClarificationSuggestion:
        received["request"] = request
        return _question()

    monkeypatch.setattr("app.api.routes.matching.clarify_matching", fake_clarify)

    response = client.post("/matching/clarify", json=CLARIFY_BODY)

    assert response.status_code == 200
    assert response.json() == {
        "question": {"question": "Could you describe your Java work?", "rationale": "Java is required for this offer."}
    }
    assert received["request"].matching_id == "m-1"
    assert received["request"].remaining_questions == 2
    assert len(received["request"].clarifications) == 2


def test_clarify_returns_a_null_question(monkeypatch):
    monkeypatch.setattr("app.api.routes.matching.clarify_matching", lambda _request: ClarificationSuggestion())

    response = client.post("/matching/clarify", json=CLARIFY_BODY)

    assert response.status_code == 200
    assert response.json() == {"question": None}


def test_clarify_with_no_question_left_is_null_through_the_real_pipeline(monkeypatch):
    def no_agent(**_kwargs):
        raise AssertionError("the agent must not be built when no question is left")

    monkeypatch.setattr("app.agents.matching_clarify.build_matching_clarify_agent", no_agent)

    response = client.post("/matching/clarify", json={**CLARIFY_BODY, "remainingQuestions": 0})

    assert response.status_code == 200
    assert response.json() == {"question": None}


@pytest.mark.parametrize(
    ("candidate", "offer"),
    [({"schemaVersion": "2"}, {"schemaVersion": "2"}), ({"schemaVersion": "3"}, {"schemaVersion": "1"})],
)
def test_clarify_rejects_stale_sheets_with_422(monkeypatch, candidate, offer):
    monkeypatch.setattr("app.api.routes.matching.clarify_matching", lambda _request: _question())

    response = client.post("/matching/clarify", json={**CLARIFY_BODY, "candidate": candidate, "offer": offer})

    assert response.status_code == 422
    assert "schemaVersion" in response.text


@pytest.mark.parametrize(
    "override",
    [
        {"remainingQuestions": 11},
        {"remainingQuestions": -1},
        {"remainingQuestions": None},
        {"assessments": []},
        {"assessments": [{"criterionKey": "skill:cobol", "score": 0, "rationale": "r"}]},
        {"assessments": [{"criterionKey": "skill:java", "score": 50, "rationale": "r"}]},
        {"clarifications": [{"question": "Q?", "status": "open"}]},
        {"matchingId": ""},
    ],
)
def test_clarify_rejects_a_malformed_request_with_422(monkeypatch, override):
    monkeypatch.setattr("app.api.routes.matching.clarify_matching", lambda _request: _question())

    assert client.post("/matching/clarify", json={**CLARIFY_BODY, **override}).status_code == 422


@pytest.mark.parametrize("field", ["matchingId", "candidate", "offer", "criteria", "assessments", "remainingQuestions"])
def test_clarify_rejects_an_incomplete_body_with_422(field):
    body = {key: value for key, value in CLARIFY_BODY.items() if key != field}

    assert client.post("/matching/clarify", json=body).status_code == 422


def test_clarify_accepts_a_body_without_clarifications(monkeypatch):
    received = {}

    def fake_clarify(request):
        received["request"] = request
        return _question()

    monkeypatch.setattr("app.api.routes.matching.clarify_matching", fake_clarify)
    body = {key: value for key, value in CLARIFY_BODY.items() if key != "clarifications"}

    assert client.post("/matching/clarify", json=body).status_code == 200
    assert received["request"].clarifications == []


def test_clarify_empty_criteria_through_the_real_pipeline_is_a_422_with_the_business_message():
    response = client.post("/matching/clarify", json={**CLARIFY_BODY, "criteria": [], "assessments": []})

    assert response.status_code == 422
    assert response.json()["detail"] == "The matching has no criterion to clarify."


@pytest.mark.parametrize(("code", "status"), [("empty_criteria", 422), ("no_output", 502), ("unknown", 500)])
def test_clarify_maps_pipeline_errors_to_http_statuses(monkeypatch, code, status):
    def failing(_request):
        raise MatchingClarifyError(code, "Safe message.")

    monkeypatch.setattr("app.api.routes.matching.clarify_matching", failing)

    response = client.post("/matching/clarify", json=CLARIFY_BODY, headers={"X-Request-Id": "job-456"})

    assert response.status_code == status
    assert response.json()["detail"] == "Safe message."
    assert response.headers["X-Request-Id"] == "job-456"


def test_clarify_logs_counts_only_never_the_content(monkeypatch, caplog):
    monkeypatch.setattr("app.api.routes.matching.clarify_matching", lambda _request: _question())

    with caplog.at_level(logging.INFO, logger="app.api.routes.matching"):
        client.post("/matching/clarify", json=CLARIFY_BODY)

    assert "criteria=1, clarifications=2, remaining=2" in caplog.text
    assert "question=asked" in caplog.text
    assert "SECRET-ANSWER" not in caplog.text
    assert "Java work" not in caplog.text
