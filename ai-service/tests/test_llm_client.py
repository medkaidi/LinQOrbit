"""Model factory tests — object construction only, no LLM call, no network."""

from app.core.config import settings
from app.llm.client import get_model, reset_model_cache


def test_get_model_uses_configured_model_name(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    model = get_model()

    assert model.model == settings.llm_model


def test_get_model_is_cached(monkeypatch):
    monkeypatch.setattr(settings, "google_api_key", "test-key")
    reset_model_cache()

    first = get_model()
    second = get_model()

    assert first is second

    reset_model_cache()
    assert get_model() is not first
