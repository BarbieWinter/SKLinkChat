import pytest
from pydantic import ValidationError

from app.shared.config import get_settings


def test_settings_fail_fast_when_redis_url_missing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("SERVER_PY_REDIS_URL", raising=False)
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        get_settings()


def test_settings_loads_valid_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_PORT", "8100")
    monkeypatch.setenv("SERVER_PY_RECONNECT_WINDOW_SECONDS", "180")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.port == 8100
    assert settings.reconnect_window_seconds == 180
