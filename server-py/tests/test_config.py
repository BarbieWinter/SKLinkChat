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


def test_settings_rejects_non_postgresql_database_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", "sqlite+aiosqlite:///./test.sqlite3")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SQLite is not supported"):
        get_settings()
