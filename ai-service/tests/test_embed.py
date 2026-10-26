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


def _dims():
    return settings.embedding_dimensions


# Every structurally invalid provider output the SDK could hand back (T64-A1): none may leak as a raw exception.
INVALID_OUTPUTS = {
    "none": lambda: None,
    "container is not a sequence": lambda: 42,
    "container is a string": lambda: "not vectors",
    "container is a mapping": lambda: {"embedding": [1.0]},
    "vector list holds None": lambda: [None],
    "vector is an int": lambda: [123],
    "vector is a string": lambda: ["x" * _dims()],
    "vector is a mapping": lambda: [{i: 1.0 for i in range(_dims())}],
    "vector is a scalar float": lambda: [0.5],
    "one vector for two texts": lambda: [_unit(_dims())],
    "three vectors for two texts": lambda: [_unit(_dims())] * 3,
    "too few dimensions": lambda: [[1.0] * (_dims() - 1)] * 2,
    "too many dimensions": lambda: [[1.0] * (_dims() + 1)] * 2,
    "empty vectors": lambda: [[], []],
    "component is None": lambda: [[None] + [0.0] * (_dims() - 1)] * 2,
    "component is a string": lambda: [["1.0"] + [0.0] * (_dims() - 1)] * 2,
    "component is a boolean": lambda: [[True] + [0.0] * (_dims() - 1)] * 2,
    "component is a nested list": lambda: [[[1.0]] + [0.0] * (_dims() - 1)] * 2,
    "component is an int too large for a float": lambda: [[10**400] + [0.0] * (_dims() - 1)] * 2,
    "component is NaN": lambda: [[float("nan")] + [0.0] * (_dims() - 1)] * 2,
    "component is infinite": lambda: [[float("inf")] + [0.0] * (_dims() - 1)] * 2,
    # T-64 audit C1: finite but degenerate vectors (value * value overflowed to inf, norm inf, every
    # component divided down to 0.0 and the result was delivered as a 200).
    "every component is huge": lambda: [[1e200] * _dims()] * 2,
    "huge negative components": lambda: [[-1e200] * _dims()] * 2,
    "one huge component among normal ones": lambda: [[1e200] + [0.5] * (_dims() - 1)] * 2,
    "largest finite components": lambda: [[1.7e308] * _dims()] * 2,
    "just above the plausible magnitude": lambda: [[2e6] + [0.0] * (_dims() - 1)] * 2,
    # Subnormal floats lose their precision: the normalized result is not unit-length, so it is refused.
    "subnormal components": lambda: [[5e-324] * _dims()] * 2,
    "all zeros": lambda: [[0.0] * _dims()] * 2,
    "negative zeros": lambda: [[-0.0] * _dims()] * 2,
}


@pytest.mark.parametrize("build", INVALID_OUTPUTS.values(), ids=INVALID_OUTPUTS.keys())
def test_an_invalid_provider_output_is_a_no_output_error_never_a_raw_exception(monkeypatch, build):
    _use(monkeypatch, FakeEmbeddings(build()))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["one", "two"])

    assert caught.value.code == "no_output"
    # The message is ours: no SDK detail, no Python exception name.
    assert "Error" not in caught.value.message and "NoneType" not in caught.value.message


def test_a_valid_output_given_as_tuples_is_accepted_and_returned_as_lists(monkeypatch):
    dims = _dims()
    _use(monkeypatch, FakeEmbeddings([tuple(_unit(dims, 0)), tuple(_unit(dims, 1))]))

    result = embed_texts(["a", "b"])

    assert isinstance(result, list) and all(isinstance(vector, list) for vector in result)
    assert result[0][0] == 1.0 and result[1][1] == 1.0


def test_integer_components_are_accepted_as_numbers(monkeypatch):
    vector = [0] * _dims()
    vector[0] = 1
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert result[0] == 1.0 and isinstance(result[0], float)


def _is_unit(vector):
    return math.isfinite(sum(v * v for v in vector)) and math.isclose(math.hypot(*vector), 1.0, rel_tol=1e-12)


@pytest.mark.parametrize("magnitude", [1e-200, 1e-6, 1.0, 1e3, 1e6])
def test_extreme_but_plausible_magnitudes_are_normalized_to_a_unit_vector(monkeypatch, magnitude):
    vector = [magnitude] * _dims()
    _use(monkeypatch, FakeEmbeddings([vector]))

    [result] = embed_texts(["text"])

    assert all(math.isfinite(v) for v in result) and _is_unit(result)


def test_the_returned_vector_is_always_finite_and_unit_length_whatever_the_provider_sends(monkeypatch):
    mixed = [10.0 ** (index % 12 - 6) * (-1) ** index for index in range(_dims())]
    _use(monkeypatch, FakeEmbeddings([mixed]))

    [result] = embed_texts(["text"])

    assert _is_unit(result)


def test_the_final_unit_check_still_rejects_when_the_magnitude_bound_is_lifted(monkeypatch):
    # Defence in depth: even without the bound, a norm that overflows (components near the float
    # limit) leaves a degenerate result — refused by the post-normalization check, never delivered.
    monkeypatch.setattr(embed_module, "MAX_COMPONENT", float("inf"))
    _use(monkeypatch, FakeEmbeddings([[1.7e308] * _dims()]))

    with pytest.raises(EmbedError) as caught:
        embed_texts(["text"])

    assert caught.value.code == "no_output"


def test_without_the_bound_hypot_alone_normalizes_huge_components_without_overflow(monkeypatch):
    monkeypatch.setattr(embed_module, "MAX_COMPONENT", float("inf"))
    _use(monkeypatch, FakeEmbeddings([[1e200] * _dims()]))

    [result] = embed_texts(["text"])

    assert _is_unit(result)


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
