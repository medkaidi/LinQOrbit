"""Embedding module tests: the provider is stubbed (no network, no quota)."""

import math

import pytest

from app.agents import embed as embed_module
from app.agents.embed import EmbedError, embed_texts
from app.core.config import settings
from app.llm.client import get_embeddings, reset_model_cache


class FakeEmbeddings:
    def __init__(self, vectors=None, error=None):
        self.vectors = vectors
        self.error = error
        self.received = None

    def embed_documents(self, texts):
        self.received = texts
        if self.error is not None:
            raise self.error
        return self.vectors


def _use(monkeypatch, fake):
    monkeypatch.setattr(embed_module, "get_embeddings", lambda: fake)
    return fake


def _unit(dimensions, index=0):
    vector = [0.0] * dimensions
    vector[index] = 1.0
    return vector


def test_vectors_come_back_in_request_order(monkeypatch):
    dims = settings.embedding_dimensions
    fake = _use(monkeypatch, FakeEmbeddings([_unit(dims, 0), _unit(dims, 1)]))

    result = embed_texts(["first", "second"])

    assert fake.received == ["first", "second"]
    assert result[0][0] == 1.0 and result[1][1] == 1.0


def test_a_vector_that_is_not_unit_length_is_normalized(monkeypatch):
    dims = settings.embedding_dimensions
    vector = [0.0] * dims
    vector[0] = 3.0
    vector[1] = 4.0
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert math.isclose(math.sqrt(sum(v * v for v in result)), 1.0, rel_tol=1e-9)
    assert math.isclose(result[0], 0.6) and math.isclose(result[1], 0.8)


def test_a_wrong_dimension_is_rejected(monkeypatch):
    _use(monkeypatch, FakeEmbeddings([[1.0, 0.0, 0.0]]))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "no_output"


def test_a_wrong_vector_count_is_rejected(monkeypatch):
    dims = settings.embedding_dimensions
    _use(monkeypatch, FakeEmbeddings([_unit(dims)]))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["one", "two"])

    assert caught.value.code == "no_output"


def test_a_null_vector_is_rejected(monkeypatch):
    _use(monkeypatch, FakeEmbeddings([[0.0] * settings.embedding_dimensions]))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "no_output"


@pytest.mark.parametrize("message", ["429 Too Many Requests", "RESOURCE_EXHAUSTED: out of quota"])
def test_a_quota_error_is_reported_as_rate_limited(monkeypatch, message):
    _use(monkeypatch, FakeEmbeddings(error=RuntimeError(message)))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "rate_limited"


def test_another_provider_failure_never_leaks_its_message(monkeypatch):
    _use(monkeypatch, FakeEmbeddings(error=RuntimeError("secret api details")))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "provider_error"
    assert "secret" not in caught.value.message


def test_get_embeddings_uses_the_configured_model_and_is_cached(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    first = get_embeddings()

    assert first.model.endswith(settings.embedding_model)
    assert first.output_dimensionality == settings.embedding_dimensions
    assert get_embeddings() is first

    reset_model_cache()
    assert get_embeddings() is not first


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_a_non_finite_value_is_rejected_instead_of_poisoning_the_vector(monkeypatch, bad):
    vector = [0.0] * settings.embedding_dimensions
    vector[0] = bad
    vector[1] = 1.0
    _use(monkeypatch, FakeEmbeddings([vector]))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "no_output"


def test_a_vector_within_the_tolerance_of_unit_length_is_returned_untouched(monkeypatch):
    dims = settings.embedding_dimensions
    vector = [0.0] * dims
    vector[0] = 1.0004
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert result[0] == 1.0004


def test_a_vector_just_outside_the_tolerance_is_normalized(monkeypatch):
    dims = settings.embedding_dimensions
    vector = [0.0] * dims
    vector[0] = 1.01
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert math.isclose(result[0], 1.0)


def test_negative_components_keep_their_sign_when_normalized(monkeypatch):
    dims = settings.embedding_dimensions
    vector = [0.0] * dims
    vector[0] = -3.0
    vector[1] = 4.0
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert math.isclose(result[0], -0.6) and math.isclose(result[1], 0.8)


def test_every_text_of_a_batch_is_normalized_independently(monkeypatch):
    dims = settings.embedding_dimensions
    first = [0.0] * dims
    first[0] = 2.0
    second = [0.0] * dims
    second[1] = 10.0
    _use(monkeypatch, FakeEmbeddings([first, second]))

    result = embed_texts(["a", "b"])

    assert result[0][0] == 1.0 and result[1][1] == 1.0


def test_the_provider_message_and_the_texts_never_reach_the_logs(monkeypatch, caplog):
    _use(monkeypatch, FakeEmbeddings(error=RuntimeError("provider says: confidential candidate text")))

    with caplog.at_level("DEBUG"), pytest.raises(EmbedError):
        embed_texts(["confidential candidate text"])

    assert "confidential" not in caplog.text


def test_the_embedding_model_is_built_for_semantic_similarity(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    # Same task type on both sides of the screening: candidate and offer share one vector space.
    assert get_embeddings().task_type == "SEMANTIC_SIMILARITY"
    reset_model_cache()


def test_the_embedding_settings_come_from_the_environment(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("EMBEDDING_MODEL", "other-embedding-model")
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "768")

    loaded = Settings()

    assert loaded.embedding_model == "other-embedding-model"
    assert loaded.embedding_dimensions == 768
    assert Settings().embedding_model != "" and settings.embedding_dimensions == 1536
