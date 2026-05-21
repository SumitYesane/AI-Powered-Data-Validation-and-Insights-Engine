"""Application configuration for SmartPipeline."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and `.env`."""

    app_name: str = "SmartPipeline"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False
    database_url: str = Field(
        default="postgresql+asyncpg://sp_user:sp_pass@postgres:5432/smartpipeline",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    redis_url: str = Field(
        default="redis://redis:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "redis_url"),
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY", "gemini_api_key", "google_api_key"),
    )
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]
    upload_dir: Path = Path("/tmp")
    max_upload_size_bytes: int = 50 * 1024 * 1024
    query_preview_rows: int = 25

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def google_api_key(self) -> str | None:
        """Return the configured Gemini API key using the legacy attribute name."""

        return self.gemini_api_key


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached application settings instance."""

    return Settings()
