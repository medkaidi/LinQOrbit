"""Route tests: validation and error mapping. The pipeline is stubbed (no LLM)."""

import pytest
from fastapi.testclient import TestClient

from app.agents.job_offer_normalize import JobOfferNormalizeError
from app.main import app
from app.schemas.job_offer import JobOfferSnapshot, NormalizedJobOffer

client = TestClient(app)

OFFER_BODY = {
    "offer": {
        "title": "Senior Backend Engineer",
        "description": "You will own the public API.",
        "seniority": "senior",
        "requiredExpYear": 3,
        "city": "Paris",
        "country": "FR",
        "contractTypeLabel": "Permanent",
        "employmentTypeLabel": "Full-time",
        "workModeLabel": "Hybrid",
        "company": {"name": "Acme", "description": "We build payments."},
        "skills": [{"name": "Java", "requirementType": "mandatory", "weight": 5}],
        "languages": [{"name": "English", "level": "B2", "isRequired": True}],
        "degreeLabels": ["Master"],
        "studyFieldLabels": ["Computer Science"],
    },
    "context": {"languages": ["French"]},
}


def _post(body=None):
    return client.post("/job-offer/normalize", json=OFFER_BODY if body is None else body)


def test_normalize_endpoint_returns_the_canonical_offer(monkeypatch):
    received = {}

    def fake_normalize(offer, context=None) -> NormalizedJobOffer:
        received["offer"] = offer
        received["context"] = context
        return NormalizedJobOffer(title="Senior Backend Engineer", summary="Own the API.")

    monkeypatch.setattr("app.api.routes.job_offer.normalize_job_offer", fake_normalize)
    response = _post()

    assert response.status_code == 200
    assert response.json()["title"] == "Senior Backend Engineer"
    assert response.json()["schemaVersion"] == "1"
    assert isinstance(received["offer"], JobOfferSnapshot)
    assert received["offer"].contract_type_label == "Permanent"
    assert received["context"].languages == ["French"]


def test_normalize_endpoint_serialises_the_camel_case_contract(monkeypatch):
    def fake_normalize(offer, context=None) -> NormalizedJobOffer:
        return NormalizedJobOffer(
            title="Senior Backend Engineer",
            contract_type="permanent",
            work_time="full_time",
            work_mode="hybrid",
            responsibilities=[
                {
                    "text": "Own the public API",
                    "importance": "mandatory",
                    "technologies": ["Java"],
                }
            ],
            required_skills=[
                {
                    "name": "Java",
                    "category": "programming_language",
                    "level": 4,
                    "level_source": "declared",
                    "min_years": 3,
                    "origin": "declared",
                    "evidence": [{"source": "responsibility", "index": 0}],
                }
            ],
            preferred_skills=[
                {"name": "Kubernetes", "category": "tool", "origin": "inferred"}
            ],
        )

    monkeypatch.setattr("app.api.routes.job_offer.normalize_job_offer", fake_normalize)
    response = _post()

    assert response.status_code == 200
    body = response.json()
    assert body["contractType"] == "permanent"
    assert body["workTime"] == "full_time"
    assert body["workMode"] == "hybrid"
    assert body["responsibilities"][0]["importance"] == "mandatory"
    assert body["requiredSkills"][0]["minYears"] == 3
    assert body["requiredSkills"][0]["levelSource"] == "declared"
    assert body["requiredSkills"][0]["evidence"][0]["source"] == "responsibility"
    assert body["preferredSkills"][0]["origin"] == "inferred"
    assert "required_skills" not in body


def test_normalize_endpoint_accepts_a_body_without_context(monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.job_offer.normalize_job_offer",
        lambda offer, context=None: NormalizedJobOffer(title="Dev"),
    )
    response = _post({"offer": {"title": "Dev"}})

    assert response.status_code == 200


def test_normalize_endpoint_rejects_a_body_without_offer():
    response = _post({"context": {"languages": ["French"]}})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("code", "expected_status"),
    [("empty_offer", 422), ("no_output", 502)],
)
def test_normalize_endpoint_maps_pipeline_errors(monkeypatch, code, expected_status):
    def failing_normalize(offer, context=None) -> NormalizedJobOffer:
        raise JobOfferNormalizeError(code, f"message for {code}")

    monkeypatch.setattr("app.api.routes.job_offer.normalize_job_offer", failing_normalize)
    response = _post()

    assert response.status_code == expected_status
    assert response.json()["detail"] == f"message for {code}"


def test_normalize_endpoint_maps_an_unknown_code_to_500(monkeypatch):
    def failing_normalize(offer, context=None) -> NormalizedJobOffer:
        raise JobOfferNormalizeError("unexpected_code", "message for unexpected_code")

    monkeypatch.setattr("app.api.routes.job_offer.normalize_job_offer", failing_normalize)
    response = _post()

    assert response.status_code == 500
    assert response.json()["detail"] == "message for unexpected_code"
