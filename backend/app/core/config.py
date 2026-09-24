from functools import lru_cache

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "URL Threat Detection API"
    ENVIRONMENT: str = "development"  # development | staging | production
    # Real bug found via adversarial testing 2026-09-14: DEBUG=True as the
    # DEFAULT meant any unhandled exception got rendered as a raw Python
    # traceback straight to the client, bypassing the structured error
    # handling in core/errors.py entirely. Defaults to False now - opt into
    # it explicitly per environment, never ship it as the fallback.
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] | list[str] = ["http://localhost:5173"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
