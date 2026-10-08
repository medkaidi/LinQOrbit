"""Service configuration.

Two layers read the same `.env` file:

- `load_dotenv()` exports every variable into `os.environ`, where LangChain,
  LangSmith and `ChatGoogleGenerativeAI` look them up natively.
- `pydantic-settings` parses them again into the typed `settings` object below,
  so our own code gets attributes with types and defaults instead of `os.getenv`.
"""

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    """Service configuration, read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    version: str = "0.1.0"

    # Logging — consumed by app.core.logging.configure_logging (see app/main.py).
    log_level: str = "INFO"

    # Google Gemini — consumed by ChatGoogleGenerativeAI (see app/llm/client.py).
    google_api_key: str = ""
    llm_model: str = "gemini-3.1-flash-lite"


settings = Settings()
