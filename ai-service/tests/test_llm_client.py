"""Model factory tests — object construction only, no LLM call, no network."""

from app.core.config import settings
from app.llm.client import get_model, reset_model_cache


def test_get_model_uses_configured_model_name(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    model = get_model()

    assert model.model == settings.llm_model


def test_get_model_passes_the_call_bounds(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_timeout_seconds", 42.0)
    monkeypatch.setattr(settings, "llm_max_retries", 5)
    reset_model_cache()

    model = get_model()

    # The SDK stores request_timeout / retries as timeout / max_retries.
    assert model.timeout == 42.0
    assert model.max_retries == 5


def test_get_model_is_cached(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    first = get_model()
    second = get_model()

    assert first is second

    reset_model_cache()
    assert get_model() is not first


def test_the_cache_keeps_the_temperature_apart(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    default = get_model()
    deterministic = get_model(temperature=0.0)

    # Sans température : défaut du fournisseur, jamais l'instance à 0 du matching.
    assert default is not deterministic
    assert default.temperature is None
    assert deterministic.temperature == 0.0
    assert get_model() is default
    assert get_model(temperature=0.0) is deterministic
