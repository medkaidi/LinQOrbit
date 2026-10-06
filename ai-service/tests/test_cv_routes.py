"""Route tests: validation and error mapping. The pipeline is stubbed (no LLM)."""

import pytest
from fastapi.testclient import TestClient

from app.agents.cv_parse import CVParseError
from app.main import app
from app.schemas.cv import ParsedCv

client = TestClient(app)


def _upload(monkeypatch, content: bytes, content_type: str = "application/pdf", pipeline=None):
    if pipeline is not None:
        monkeypatch.setattr("app.api.routes.cv.parse_cv", pipeline)
    return client.post("/cv/parse", files={"file": ("cv.pdf", content, content_type)})


def test_parse_endpoint_returns_the_structured_cv(monkeypatch):
    received = {}

    def fake_parse(data: bytes, context=None) -> ParsedCv:
        received["data"] = data
        return ParsedCv(title="Backend Engineer")

    response = _upload(monkeypatch, b"%PDF-fake-bytes", pipeline=fake_parse)

    assert response.status_code == 200
    assert response.json() == {"title": "Backend Engineer", "summary": None, "experiences": [], "diplomas": [], "skills": [], "languages": [], "links": []}
    assert received["data"] == b"%PDF-fake-bytes"


def test_parse_endpoint_forwards_the_reference_context(monkeypatch):
    received = {}

    def fake_parse(data: bytes, context=None) -> ParsedCv:
        received["context"] = context
        return ParsedCv(title="Backend Engineer")

    monkeypatch.setattr("app.api.routes.cv.parse_cv", fake_parse)
    response = client.post(
        "/cv/parse",
        files={"file": ("cv.pdf", b"%PDF-fake-bytes", "application/pdf")},
        data={
            "context": '{"languages": ["French"], "studyFields": ["Computer Science"],'
            ' "skills": {"Software": ["Microsoft Excel"]}}'
        },
    )

    assert response.status_code == 200
    reference = received["context"]
    assert reference.languages == ["French"]
    assert reference.study_fields == ["Computer Science"]
    assert reference.skills == {"Software": ["Microsoft Excel"]}


def test_parse_endpoint_rejects_invalid_context_json():
    response = client.post(
        "/cv/parse",
        files={"file": ("cv.pdf", b"%PDF-fake", "application/pdf")},
        data={"context": "not json at all"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid reference context."


def test_parse_endpoint_serialises_the_camel_case_contract(monkeypatch):
    def fake_parse(data: bytes, context=None) -> ParsedCv:
        return ParsedCv(
            title="Backend Engineer",
            experiences=[
                {
                    "position_title": "Backend Engineer",
                    "company_name": "Acme",
                    "start_date": "2021-03",
                    "end_date": None,
                    "description": "API payments",
                }
            ],
        )

    response = _upload(monkeypatch, b"%PDF-fake-bytes", pipeline=fake_parse)

    assert response.status_code == 200
    experience = response.json()["experiences"][0]
    assert experience["positionTitle"] == "Backend Engineer"
    assert experience["startDate"] == "2021-03"
    assert "start_date" not in experience


def test_parse_endpoint_rejects_non_pdf_content_type(monkeypatch):
    response = _upload(monkeypatch, b"hello", content_type="text/plain")

    assert response.status_code == 415
    assert response.json()["detail"] == "Only PDF files are supported."


def test_parse_endpoint_rejects_files_over_the_limit(monkeypatch):
    monkeypatch.setattr("app.api.routes.cv.MAX_FILE_SIZE", 4)

    response = _upload(monkeypatch, b"12345")

    assert response.status_code == 413


@pytest.mark.parametrize(
    ("code", "expected_status"),
    [("invalid_pdf", 400), ("no_text", 422), ("no_output", 502)],
)
def test_parse_endpoint_maps_pipeline_errors(monkeypatch, code, expected_status):
    def failing_parse(data: bytes, context=None) -> ParsedCv:
        raise CVParseError(code, f"message for {code}")

    response = _upload(monkeypatch, b"%PDF-fake", pipeline=failing_parse)

    assert response.status_code == expected_status
    assert response.json()["detail"] == f"message for {code}"
