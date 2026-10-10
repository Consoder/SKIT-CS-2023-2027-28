"""
Sprint 3, Task 1 (FastAPI skeleton, routing & config — due 05-09-2026):
environment-driven settings shared by every backend module.
"""

from functools import lru_cache

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "URL Threat Detection API"
    ENVIRONMENT: str = "development"  # development | staging | production
    # Real security bug found via adversarial testing 2026-09-14: DEBUG=True
    # as the DEFAULT meant that any unhandled exception (e.g. an
    # httpx.InvalidURL from a malicious extremely-long URL) got rendered as
    # a raw Python traceback straight to the client, completely bypassing
    # our own custom error handlers in errors.py. A "never leak internals"
    # guarantee is worthless if the framework's own debug mode overrides
    # it by default. Defaults to False now - opt into it explicitly per
    # environment, never ship it as the fallback.
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] | list[str] = ["http://localhost:5173"]

    # Sprint 6, Task 1 (VirusTotal & AbuseIPDB integration — due 15-12-2026).
    # Optional on purpose: without keys the client degrades to "unavailable"
    # per provider instead of failing the whole request.
    VIRUSTOTAL_API_KEY: str | None = None
    ABUSEIPDB_API_KEY: str | None = None

    # Perf fix from stress testing 2026-09-14: a slow/rate-limited external
    # API used to block the whole /analyze response for as long as it took
    # to retry and back off (observed: multi-second tail latency). Past
    # this timeout, threat-intel is treated as unavailable and the request
    # proceeds with an ML-only verdict instead of waiting - a deliberate
    # speed-over-completeness tradeoff.
    THREAT_INTEL_TIMEOUT_SECONDS: float = 2.0

    # Sprint 6, Task 2 (Redis caching layer — due 15-01-2027).
    # Optional on purpose: without it, caching is disabled and every
    # request runs the full pipeline - never a startup/request failure.
    REDIS_URL: str | None = None
    CACHE_TTL_SECONDS: int = 3600

    # Sprint 6, Task 3 (PostgreSQL schema & indexing — due 10-02-2027).
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/url_threat_detection"

    # Sprint 6, Task 4 (blockchain audit logging — due 10-03-2027).
    # Optional on purpose: without it, analyses still work, they just
    # aren't anchored on-chain (see BlockchainAuditLogger.anchor()).
    BLOCKCHAIN_RPC_URL: str | None = None
    BLOCKCHAIN_CONTRACT_ADDRESS: str | None = None
    BLOCKCHAIN_ACCOUNT_ADDRESS: str | None = None
    # Real gap found 2026-09-14, closed 2026-09-25: without this, the node
    # signed transactions for us (fine for local Ganache, never for a real
    # deployment). When set, BlockchainAuditLogger signs locally instead -
    # the node never sees this value. Never log this setting's value.
    BLOCKCHAIN_PRIVATE_KEY: str | None = None

    # Real gap found 2026-09-14, not in any sprint task: /analyze had no
    # rate limiting - we exhausted VirusTotal's real quota on ourselves
    # during stress testing. See core/rate_limit.py for the Redis-backed
    # implementation (needed since Docker now runs multiple workers).
    ANALYZE_RATE_LIMIT: str = "20/minute"

    # Real gap found 2026-09-14, not in any sprint task: /analyze was fully
    # open, no authentication at all. Optional on purpose, same pattern as
    # everything else here: unset = disabled (fine for local dev), set it
    # to actually require the header in a real deployment.
    API_KEY: str | None = None

    # Real gap found 2026-09-25: auth was a single shared secret, not real
    # per-user accounts - the `users` table existed but nothing issued
    # per-user tokens. JWT_SECRET_KEY has a dev-only default (unlike
    # API_KEY/BLOCKCHAIN_PRIVATE_KEY, which stay unset/disabled by default)
    # because unlike those, there's no "disabled" state for signing tokens
    # that already-issued tokens depend on - a real deployment MUST
    # override this with a long random value (e.g. `openssl rand -hex 32`),
    # or every token it issues is forgeable by anyone who reads this file.
    JWT_SECRET_KEY: str = "dev-only-insecure-secret-override-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
