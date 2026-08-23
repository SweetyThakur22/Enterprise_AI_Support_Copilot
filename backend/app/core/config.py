"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://copilot:copilot@localhost:5432/copilot"
    ANTHROPIC_API_KEY: str = ""
    # LLM provider: "anthropic" (Claude) or "openai" (any OpenAI-compatible API, e.g. Groq/Gemini)
    LLM_PROVIDER: str = "anthropic"
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "claude-sonnet-4-6"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    SENTRY_DSN: str = ""

    def validate_production_secrets(self) -> None:
        """Raise at startup if required secrets are missing or default in production."""
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "change-me-in-production":
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            if self.LLM_PROVIDER == "anthropic" and not self.ANTHROPIC_API_KEY:
                raise ValueError(
                    "ANTHROPIC_API_KEY must be set in production when LLM_PROVIDER=anthropic. "
                    "Obtain one from https://console.anthropic.com"
                )
            if self.LLM_PROVIDER != "anthropic" and not self.LLM_API_KEY:
                raise ValueError(
                    "LLM_API_KEY must be set in production when using an OpenAI-compatible "
                    "LLM_PROVIDER (e.g. Groq)."
                )


settings = Settings()

if settings.ENVIRONMENT == "production":
    settings.validate_production_secrets()
