from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    version: str = "0.1.0"

    # LLM provider — used when the first real LLM calls are implemented.
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = ""


settings = Settings()
