"""Matching route: validation, camelCase output and error mapping. The pipeline is stubbed (no LLM)."""

import pytest
from fastapi.testclient import TestClient

from app.agents.matching_analyze import MatchingAnalyzeError
from app.main import app
from app.schemas.matching import MatchingAnalysis, MatchingAnalyzeRequest

client = TestClient(app)

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
            assessments=[{"criterion_key": "skill:java", "score": 80, "rationale": "Shown."}],
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
