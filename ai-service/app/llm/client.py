"""Chat model factory: the single place where the LLM is instantiated.

Everything else asks for a model through `get_model()`, so the provider
(Google Gemini), the model name and the credentials stay in one testable spot.
"""

import logging
from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_model() -> ChatGoogleGenerativeAI:
    """Return the process-wide model instance.

    Cached on purpose: building a client per request would rebuild the
    underlying transport every time. Pass ``None`` when no explicit key is set
    so the SDK falls back to ``GOOGLE_API_KEY`` exported in the environment.
    """
    logger.info("LLM model initialized : model=%s", settings.llm_model)
    return ChatGoogleGenerativeAI(
        model=settings.llm_model,
        google_api_key=settings.google_api_key or None,
        request_timeout=settings.llm_timeout_seconds,
        retries=settings.llm_max_retries,
    )


def reset_model_cache() -> None:
    """Testing hook: drop the cached instance after changing settings or env."""
    get_model.cache_clear()
