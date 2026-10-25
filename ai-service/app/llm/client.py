"""Chat model factory: the single place where the LLM is instantiated.

Everything else asks for a model through `get_model()`, so the provider
(Google Gemini), the model name and the credentials stay in one testable spot.
"""

import logging
from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def get_model(temperature: float | None = None) -> ChatGoogleGenerativeAI:
    """Return the process-wide model instance for a sampling temperature.

    Cached on purpose: building a client per request would rebuild the
    underlying transport every time. The cache is keyed by ``temperature``:
    ``None`` (the default) keeps the provider's default sampling and is a
    distinct instance from an explicit ``0.0`` — an agent that asks for no
    temperature never receives the deterministic matching model. Pass
    ``None`` as key when no explicit key is set so the SDK falls back to
    ``GOOGLE_API_KEY`` exported in the environment.
    """
    logger.info("LLM model initialized : model=%s, temperature=%s", settings.llm_model, temperature)
    options = {} if temperature is None else {"temperature": temperature}
    return ChatGoogleGenerativeAI(
        model=settings.llm_model,
        google_api_key=settings.google_api_key or None,
        request_timeout=settings.llm_timeout_seconds,
        retries=settings.llm_max_retries,
        **options,
    )


@lru_cache(maxsize=1)
def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    """Return the process-wide embedding model (same provider, same credentials).

    One instance for both sides of the screening (candidate and offer fiches):
    the same model and task type put them in the same vector space (§8.4.5).
    """
    logger.info(
        "Embedding model initialized : model=%s, dimensions=%d",
        settings.embedding_model,
        settings.embedding_dimensions,
    )
    return GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model,
        google_api_key=settings.google_api_key or None,
        output_dimensionality=settings.embedding_dimensions,
        task_type="SEMANTIC_SIMILARITY",
    )


def reset_model_cache() -> None:
    """Testing hook: drop the cached instances after changing settings or env."""
    get_model.cache_clear()
    get_embeddings.cache_clear()
