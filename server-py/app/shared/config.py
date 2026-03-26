from __future__ import annotations

from functools import lru_cache
from typing import Literal, TypedDict

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(value: str) -> str:
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def to_sync_database_url(database_url: str) -> str:
    return database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SERVER_PY_", extra="ignore")

    app_name: str = "SKLinkChat Python Backend"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    reconnect_window_seconds: int = 180
    partner_disconnect_grace_seconds: float = 5.0

    redis_url: str = Field(..., min_length=1)
    database_url: str = Field(..., min_length=1)

    auth_cookie_name: str = "sklinkchat_session"
    auth_session_ttl_seconds: int = 604800
    verification_token_ttl_seconds: int = 900
    verification_resend_cooldown_seconds: int = 60
    verification_resend_hourly_limit: int = 5
    password_reset_token_ttl_seconds: int = 900
    password_reset_resend_cooldown_seconds: int = 60
    password_reset_hourly_limit: int = 5
    chat_message_ttl_seconds: int = 2592000
    registration_risk_retention_seconds: int = 15552000
    audit_event_retention_seconds: int = 31536000
    cleanup_interval_seconds: int = 60

    email_provider: Literal["fake", "mailpit", "resend"] = "fake"
    email_from_address: str = "noreply@example.com"
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    resend_api_key: str | None = None
    resend_base_url: str = "https://api.resend.com"
    frontend_base_url: str = "http://localhost:4173"

    turnstile_provider: Literal["fake", "cloudflare"] = "fake"
    turnstile_secret_key: str | None = None
    turnstile_site_key: str | None = None
    turnstile_base_url: str = "https://challenges.cloudflare.com"
    fake_turnstile_always_pass: bool = True

    secure_cookies: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        normalized = _normalize_database_url(str(value))
        if not normalized.startswith("postgresql+psycopg://"):
            raise ValueError(
                "SERVER_PY_DATABASE_URL must use PostgreSQL via postgresql+psycopg; "
                "SQLite is not supported"
            )
        return normalized

    @property
    def normalized_database_url(self) -> str:
        return self.database_url

    @property
    def sync_database_url(self) -> str:
        return to_sync_database_url(self.normalized_database_url)


class SettingsInitKwargs(TypedDict, total=False):
    app_name: str
    environment: str
    host: str
    port: int
    log_level: str
    reconnect_window_seconds: int
    partner_disconnect_grace_seconds: float
    redis_url: str
    database_url: str


@lru_cache
def get_settings() -> Settings:
    init_kwargs: SettingsInitKwargs = {}
    return Settings(**init_kwargs)
