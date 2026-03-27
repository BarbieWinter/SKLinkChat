import pytest
from pydantic import ValidationError

from app.shared.config import get_settings


def test_settings_fail_fast_when_redis_url_missing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        get_settings()


def test_settings_loads_valid_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_PORT", "8100")
    monkeypatch.setenv("SERVER_PY_RECONNECT_WINDOW_SECONDS", "180")
    monkeypatch.setenv("SERVER_PY_PARTNER_DISCONNECT_GRACE_SECONDS", "1")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.normalized_database_url == "postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat"
    assert settings.port == 8100
    assert settings.reconnect_window_seconds == 180
    assert settings.partner_disconnect_grace_seconds == 1


def test_settings_requires_resend_api_key_when_provider_is_resend(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("SERVER_PY_EMAIL_FROM", "noreply@mail.sklinkchat.com")
    monkeypatch.setenv("SERVER_PY_APP_BASE_URL", "http://localhost:4173")
    monkeypatch.setenv("SERVER_PY_RESEND_API_KEY", "")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SERVER_PY_RESEND_API_KEY is required"):
        get_settings()


def test_settings_supports_legacy_email_and_app_base_env_names(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_EMAIL_PROVIDER", "fake")
    monkeypatch.setenv("SERVER_PY_EMAIL_FROM", "")
    monkeypatch.setenv("SERVER_PY_EMAIL_FROM_ADDRESS", "legacy@example.com")
    monkeypatch.setenv("SERVER_PY_APP_BASE_URL", "")
    monkeypatch.setenv("SERVER_PY_FRONTEND_BASE_URL", "http://localhost:4173")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.email_from == "legacy@example.com"
    assert settings.app_base_url == "http://localhost:4173"


def test_settings_rejects_non_postgresql_database_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "sqlite+aiosqlite:///./test.sqlite3")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SQLite is not supported"):
        get_settings()


def test_settings_require_turnstile_site_key_when_enabled(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_ENABLED", "true")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SITE_KEY", "")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SECRET_KEY", "secret")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SERVER_PY_TURNSTILE_SITE_KEY is required"):
        get_settings()


def test_settings_require_turnstile_secret_key_when_enabled(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_ENABLED", "true")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SITE_KEY", "site")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SECRET_KEY", "")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SERVER_PY_TURNSTILE_SECRET_KEY is required"):
        get_settings()


def test_settings_require_secure_production_auth(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_ENVIRONMENT", "production")
    monkeypatch.setenv("SERVER_PY_EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("SERVER_PY_EMAIL_FROM", "noreply@mail.sklinkchat.com")
    monkeypatch.setenv("SERVER_PY_RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("SERVER_PY_APP_BASE_URL", "https://chat.example.com")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_ENABLED", "true")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SITE_KEY", "site")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_SECRET_KEY", "secret")
    monkeypatch.setenv("SERVER_PY_SECURE_COOKIES", "false")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SERVER_PY_SECURE_COOKIES must be true"):
        get_settings()


def test_settings_require_production_turnstile_and_resend(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "postgresql://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat")
    monkeypatch.setenv("SERVER_PY_ENVIRONMENT", "production")
    monkeypatch.setenv("SERVER_PY_EMAIL_PROVIDER", "fake")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_ENABLED", "false")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SERVER_PY_EMAIL_PROVIDER must be resend"):
        get_settings()
