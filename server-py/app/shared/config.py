from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal, TypedDict

from pydantic import Field, field_validator, model_validator
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
    email_from: str | None = None
    email_from_address: str | None = None
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    resend_api_key: str | None = None
    resend_base_url: str = "https://api.resend.com"
    app_base_url: str | None = None
    frontend_base_url: str | None = None

    geetest_enabled: bool = False
    geetest_register_captcha_id: str | None = None
    geetest_register_captcha_key: str | None = None
    geetest_login_captcha_id: str | None = None
    geetest_login_captcha_key: str | None = None
    geetest_base_url: str = "https://gcaptcha4.geetest.com"

    stack_auth_enabled: bool = False
    stack_project_id: str | None = None
    stack_secret_server_key: str | None = None
    stack_api_base_url: str = "https://api.stack-auth.com"

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

    @model_validator(mode="after")
    def validate_email_settings(self) -> Settings:
        self.environment = self.environment.strip().lower()
        if not self.email_from and self.email_from_address:
            self.email_from = self.email_from_address
        if not self.app_base_url and self.frontend_base_url:
            self.app_base_url = self.frontend_base_url

        self.email_from = (self.email_from or "noreply@mail.sklinkchat.com").strip()
        self.app_base_url = (self.app_base_url or "http://localhost:4173").rstrip("/")
        self.resend_api_key = self.resend_api_key.strip() if self.resend_api_key else None
        self.geetest_register_captcha_id = (
            self.geetest_register_captcha_id.strip() if self.geetest_register_captcha_id else None
        )
        self.geetest_register_captcha_key = (
            self.geetest_register_captcha_key.strip() if self.geetest_register_captcha_key else None
        )
        self.geetest_login_captcha_id = self.geetest_login_captcha_id.strip() if self.geetest_login_captcha_id else None
        self.geetest_login_captcha_key = (
            self.geetest_login_captcha_key.strip() if self.geetest_login_captcha_key else None
        )
        self.stack_project_id = (self.stack_project_id or "").strip() or None
        self.stack_secret_server_key = (self.stack_secret_server_key or "").strip() or None
        self.stack_api_base_url = (self.stack_api_base_url or "https://api.stack-auth.com").rstrip("/")

        if not self.stack_project_id:
            stack_project_id = os.getenv("STACK_PROJECT_ID") or os.getenv("NEXT_PUBLIC_STACK_PROJECT_ID") or ""
            self.stack_project_id = stack_project_id.strip() or None
        if not self.stack_secret_server_key:
            self.stack_secret_server_key = os.getenv("STACK_SECRET_SERVER_KEY", "").strip() or None

        if self.email_provider == "resend":
            if not self.resend_api_key:
                raise ValueError("SERVER_PY_RESEND_API_KEY is required when SERVER_PY_EMAIL_PROVIDER=resend")
            if not self.email_from:
                raise ValueError("SERVER_PY_EMAIL_FROM is required when SERVER_PY_EMAIL_PROVIDER=resend")
            if not self.app_base_url:
                raise ValueError("SERVER_PY_APP_BASE_URL is required when SERVER_PY_EMAIL_PROVIDER=resend")

        if self.geetest_enabled:
            if not self.geetest_register_captcha_id:
                raise ValueError(
                    "SERVER_PY_GEETEST_REGISTER_CAPTCHA_ID is required when SERVER_PY_GEETEST_ENABLED=true"
                )
            if not self.geetest_register_captcha_key:
                raise ValueError(
                    "SERVER_PY_GEETEST_REGISTER_CAPTCHA_KEY is required when SERVER_PY_GEETEST_ENABLED=true"
                )
            if not self.geetest_login_captcha_id:
                raise ValueError(
                    "SERVER_PY_GEETEST_LOGIN_CAPTCHA_ID is required when SERVER_PY_GEETEST_ENABLED=true"
                )
            if not self.geetest_login_captcha_key:
                raise ValueError(
                    "SERVER_PY_GEETEST_LOGIN_CAPTCHA_KEY is required when SERVER_PY_GEETEST_ENABLED=true"
                )

        if self.stack_auth_enabled:
            if not self.stack_project_id:
                raise ValueError("SERVER_PY_STACK_PROJECT_ID is required when SERVER_PY_STACK_AUTH_ENABLED=true")
            if not self.stack_secret_server_key:
                raise ValueError(
                    "SERVER_PY_STACK_SECRET_SERVER_KEY is required when SERVER_PY_STACK_AUTH_ENABLED=true"
                )

        if self.environment == "production":
            if self.email_provider != "resend":
                raise ValueError("SERVER_PY_EMAIL_PROVIDER must be resend when SERVER_PY_ENVIRONMENT=production")
            if not self.geetest_enabled and not self.stack_auth_enabled:
                raise ValueError(
                    "At least one verification path must be enabled in production "
                    "(SERVER_PY_GEETEST_ENABLED or SERVER_PY_STACK_AUTH_ENABLED)"
                )
            if not self.secure_cookies:
                raise ValueError("SERVER_PY_SECURE_COOKIES must be true when SERVER_PY_ENVIRONMENT=production")

        return self

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
