"""Route tests: validation and error mapping. The pipeline is stubbed (no LLM)."""

import pytest
from fastapi.testclient import TestClient

from app.agents.profile_normalize import ProfileNormalizeError
from app.main import app
from app.schemas.normalize import CandidateProfile, NormalizedProfile, ProfileAbout

client = TestClient(app)

PROFILE_BODY = {
    "profile": {
        "about": {"title": "Full Stack Developer", "bio": "Six years of APIs."},
        "experiences": [
            {
                "positionTitle": "Developer",
                "startDate": "2024-01-15",
                "endDate": None,
                "companyName": "A2S",
            }
        ],
        "projects": [
            {
                "name": "Portfolio",
                "startDate": "2023-01-01",
                "endDate": None,
                "technologies": "Next.js",
            }
        ],
        "skills": [{"name": "Java", "skillType": "Programming Languages", "level": 4}],
    },
    "location": {"currentCity": "Paris", "currentCountry": "FR"},
    "context": {"languages": ["French"], "studyFields": ["Computer Science"]},
}


def _post(body=None):
    return client.post("/profile/normalize", json=PROFILE_BODY if body is None else body)


def test_normalize_endpoint_returns_the_canonical_profile(monkeypatch):
    received = {}

    def fake_normalize(profile, location=None, context=None) -> NormalizedProfile:
        received["profile"] = profile
        received["location"] = location
        received["context"] = context
        return NormalizedProfile(title="Full Stack Developer", summary="I build APIs.")

    monkeypatch.setattr("app.api.routes.normalize.normalize_profile", fake_normalize)
    response = _post()

    assert response.status_code == 200
    assert response.json()["title"] == "Full Stack Developer"
    assert response.json()["schemaVersion"] == "3"
    assert isinstance(received["profile"], CandidateProfile)
    assert received["location"].current_city == "Paris"
    assert received["context"].study_fields == ["Computer Science"]


def test_normalize_endpoint_serialises_the_camel_case_contract(monkeypatch):
    def fake_normalize(profile, location=None, context=None) -> NormalizedProfile:
        return NormalizedProfile(
            title="Full Stack Developer",
            experiences=[
                {
                    "position_title": "Developer",
                    "company_name": "A2S",
                    "start_date": "2024-01",
                    "end_date": None,
                }
            ],
            projects=[
                {
                    "name": "Portfolio",
                    "start_date": "2023-01",
                    "end_date": None,
                    "context": "personal",
                }
            ],
            skills=[
                {
                    "name": "Java",
                    "category": "programming_language",
                    "level": 4,
                    "level_source": "declared",
                    "years_experience": 6,
                    "origin": "declared",
                    "evidence": [{"source": "experience", "index": 0}],
                }
            ],
        )

    monkeypatch.setattr("app.api.routes.normalize.normalize_profile", fake_normalize)
    response = _post()

    assert response.status_code == 200
    body = response.json()
    experience = body["experiences"][0]
    assert experience["positionTitle"] == "Developer"
    assert experience["startDate"] == "2024-01"
    assert "start_date" not in experience
    assert body["projects"][0]["name"] == "Portfolio"
    assert body["projects"][0]["context"] == "personal"
    assert body["skills"][0]["yearsExperience"] == 6
    assert body["skills"][0]["levelSource"] == "declared"
    assert body["skills"][0]["evidence"][0]["source"] == "experience"


def test_normalize_endpoint_accepts_a_body_without_context_or_location(monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.normalize.normalize_profile",
        lambda profile, location=None, context=None: NormalizedProfile(title="Dev"),
    )
    response = _post({"profile": {"about": {"title": "Dev"}}})

    assert response.status_code == 200


def test_normalize_endpoint_rejects_a_body_without_profile():
    response = _post({"context": {"languages": ["French"]}})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("code", "expected_status"),
    [("empty_profile", 422), ("no_output", 502)],
)
def test_normalize_endpoint_maps_pipeline_errors(monkeypatch, code, expected_status):
    def failing_normalize(profile, location=None, context=None) -> NormalizedProfile:
        raise ProfileNormalizeError(code, f"message for {code}")

    monkeypatch.setattr("app.api.routes.normalize.normalize_profile", failing_normalize)
    response = _post()

    assert response.status_code == expected_status
    assert response.json()["detail"] == f"message for {code}"
