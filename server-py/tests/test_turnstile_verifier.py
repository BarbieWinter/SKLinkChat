from __future__ import annotations

import asyncio

import httpx
import pytest

from app.application.platform.services import TurnstileConfigurationError, TurnstileServiceUnavailableError
from app.infrastructure.turnstile_verifier import CloudflareTurnstileVerifier
from app.shared.config import Settings


def _run(coro):
    return asyncio.run(coro)


def _settings(**overrides) -> Settings:
    payload = {
        "redis_url": "redis://localhost:6379/0",
        "database_url": "postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        "turnstile_enabled": True,
        "turnstile_site_key": "site-key",
        "turnstile_secret_key": "secret-key",
    }
    payload.update(overrides)
    return Settings(**payload)


def test_cloudflare_turnstile_verifier_success(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            captured["base_url"] = base_url

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, data: dict[str, str]) -> httpx.Response:
            captured["path"] = path
            captured["data"] = data
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify"),
                json={"success": True},
            )

    monkeypatch.setattr("app.infrastructure.turnstile_verifier.httpx.AsyncClient", StubAsyncClient)

    result = _run(CloudflareTurnstileVerifier(_settings()).verify("token-123", remote_ip="127.0.0.1"))

    assert result.success is True
    assert result.provider == "cloudflare"
    assert captured["base_url"] == "https://challenges.cloudflare.com"
    assert captured["path"] == "/turnstile/v0/siteverify"
    assert captured["data"] == {
        "secret": "secret-key",
        "response": "token-123",
        "remoteip": "127.0.0.1",
    }


def test_cloudflare_turnstile_verifier_failure(monkeypatch: pytest.MonkeyPatch):
    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, data: dict[str, str]) -> httpx.Response:
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify"),
                json={"success": False, "error-codes": ["invalid-input-response"]},
            )

    monkeypatch.setattr("app.infrastructure.turnstile_verifier.httpx.AsyncClient", StubAsyncClient)

    result = _run(CloudflareTurnstileVerifier(_settings()).verify("bad-token", remote_ip=None))

    assert result.success is False
    assert result.error_codes == ("invalid-input-response",)


def test_cloudflare_turnstile_verifier_requires_secret_key():
    settings = Settings.model_construct(
        redis_url="redis://localhost:6379/0",
        database_url="postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        turnstile_enabled=True,
        turnstile_site_key="site-key",
        turnstile_secret_key=None,
        turnstile_base_url="https://challenges.cloudflare.com",
    )
    verifier = CloudflareTurnstileVerifier(settings)

    with pytest.raises(TurnstileConfigurationError, match="SERVER_PY_TURNSTILE_SECRET_KEY is required"):
        _run(verifier.verify("token-123", remote_ip="127.0.0.1"))


def test_cloudflare_turnstile_verifier_raises_on_cloudflare_http_error(monkeypatch: pytest.MonkeyPatch):
    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, data: dict[str, str]) -> httpx.Response:
            return httpx.Response(
                500,
                request=httpx.Request("POST", f"{self.base_url}{path}"),
                json={"success": False},
            )

    monkeypatch.setattr("app.infrastructure.turnstile_verifier.httpx.AsyncClient", StubAsyncClient)

    verifier = CloudflareTurnstileVerifier(_settings())

    with pytest.raises(TurnstileServiceUnavailableError, match="validation request failed"):
        _run(verifier.verify("token-123", remote_ip="127.0.0.1"))
