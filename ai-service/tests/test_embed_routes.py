"""Route tests: validation and error mapping. The embedding call is stubbed."""

import pytest
from fastapi.testclient import TestClient

from app.agents.embed import EmbedError
from app.api.routes import embed as embed_route
from app.core.config import settings
from app.main import app
from app.schemas.embed import MAX_TEXT_LENGTH, MAX_TEXTS

client = TestClient(app)


def _post(body):
    return client.post("/embed", json=body)


def test_the_endpoint_returns_one_vector_per_text(monkeypatch):
    received = {}

    def fake_embed(texts):
        received["texts"] = texts
        return [[0.1, 0.2], [0.3, 0.4]]

    monkeypatch.setattr(embed_route, "embed_texts", fake_embed)

    response = _post({"texts": ["  first ", "second"]})

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == settings.embedding_model
    assert body["dimensions"] == settings.embedding_dimensions
    assert body["embeddings"] == [[0.1, 0.2], [0.3, 0.4]]
    # Surrounding whitespace is stripped before the provider sees the text.
    assert received["texts"] == ["first", "second"]


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"texts": []},
        {"texts": [""]},
        {"texts": ["   "]},
        {"texts": ["ok", ""]},
        {"texts": ["x" * (MAX_TEXT_LENGTH + 1)]},
        {"texts": ["x"] * (MAX_TEXTS + 1)},
        {"texts": "not a list"},
    ],
)
def test_an_invalid_payload_is_a_422_and_never_reaches_the_model(monkeypatch, body):
    def boom(texts):
        raise AssertionError("must not be called")

    monkeypatch.setattr(embed_route, "embed_texts", boom)

    assert _post(body).status_code == 422


def test_the_batch_and_text_bounds_are_accepted(monkeypatch):
    monkeypatch.setattr(embed_route, "embed_texts", lambda texts: [[1.0]] * len(texts))

    assert _post({"texts": ["x" * MAX_TEXT_LENGTH] * MAX_TEXTS}).status_code == 200


@pytest.mark.parametrize(
    ("code", "status"),
    [("rate_limited", 429), ("provider_error", 502), ("no_output", 502), ("unknown", 500)],
)
def test_embed_errors_map_to_http_statuses(monkeypatch, code, status):
    def fail(texts):
        raise EmbedError(code, "safe message")

    monkeypatch.setattr(embed_route, "embed_texts", fail)

    response = _post({"texts": ["text"]})

    assert response.status_code == status
    assert response.json() == {"detail": "safe message"}


def test_the_endpoint_is_documented_in_the_openapi_contract():
    paths = client.get("/openapi.json").json()["paths"]

    assert "post" in paths["/embed"]


def test_only_post_is_allowed_on_the_endpoint():
    assert client.get("/embed").status_code == 405


def test_the_texts_never_reach_the_logs(monkeypatch, caplog):
    monkeypatch.setattr(embed_route, "embed_texts", lambda texts: [[1.0]] * len(texts))

    with caplog.at_level("DEBUG"):
        assert _post({"texts": ["a confidential candidate profile"]}).status_code == 200

    assert "confidential" not in caplog.text


def test_a_vector_per_text_comes_back_for_a_full_batch(monkeypatch):
    monkeypatch.setattr(embed_route, "embed_texts", lambda texts: [[float(i)] for i, _ in enumerate(texts)])

    body = _post({"texts": [f"text {i}" for i in range(MAX_TEXTS)]}).json()

    assert [vector[0] for vector in body["embeddings"]] == [float(i) for i in range(MAX_TEXTS)]
