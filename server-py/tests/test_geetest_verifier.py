from __future__ import annotations

import asyncio
import hashlib
import hmac

import httpx
import pytest

from app.application.platform.services import GeeTestCaptchaPayload, GeeTestConfigurationError, GeeTestServiceUnavailableError
from app.infrastructure.geetest_verifier import GeeTestGT4Verifier
from app.shared.config import Settings


def _run(coro):
    return asyncio.run(coro)


def _settings(**overrides) -> Settings:
    payload = {
        "redis_url": "redis://localhost:6379/0",
        "database_url": "postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        "geetest_enabled": True,
        "geetest_register_captcha_id": "register-id",
        "geetest_register_captcha_key": "register-key",
        "geetest_login_captcha_id": "login-id",
        "geetest_login_captcha_key": "login-key",
    }
    payload.update(overrides)
    return Settings(**payload)


def _captcha_payload(**overrides) -> GeeTestCaptchaPayload:
    payload = {
        "lot_number": "lot-123",
        "captcha_output": "captcha-output",
        "pass_token": "pass-token",
        "gen_time": "2026-03-27T12:00:00Z",
    }
    payload.update(overrides)
    return GeeTestCaptchaPayload(**payload)


def test_geetest_verifier_success(monkeypatch: pytest.MonkeyPatch):
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
                request=httpx.Request("POST", f"https://gcaptcha4.geetest.com{path}"),
                json={"status": "success", "result": "success"},
            )

    monkeypatch.setattr("app.infrastructure.geetest_verifier.httpx.AsyncClient", StubAsyncClient)

    payload = _captcha_payload()
    result = _run(GeeTestGT4Verifier(_settings()).verify(payload, scenario="register", remote_ip="127.0.0.1"))

    assert result.success is True
    assert result.provider == "geetest"
    assert captured["base_url"] == "https://gcaptcha4.geetest.com"
    assert captured["path"] == "/validate?captcha_id=register-id"
    assert captured["data"] == {
        "lot_number": payload.lot_number,
        "captcha_output": payload.captcha_output,
        "pass_token": payload.pass_token,
        "gen_time": payload.gen_time,
        "sign_token": hmac.new(b"register-key", b"lot-123", digestmod=hashlib.sha256).hexdigest(),
        "ip_address": "127.0.0.1",
    }


def test_geetest_verifier_failure(monkeypatch: pytest.MonkeyPatch):
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
                request=httpx.Request("POST", f"https://gcaptcha4.geetest.com{path}"),
                json={"status": "success", "result": "fail", "reason": "forbidden"},
            )

    monkeypatch.setattr("app.infrastructure.geetest_verifier.httpx.AsyncClient", StubAsyncClient)

    result = _run(GeeTestGT4Verifier(_settings()).verify(_captcha_payload(), scenario="login", remote_ip=None))

    assert result.success is False
    assert result.error_codes == ("forbidden",)


def test_geetest_verifier_requires_register_key():
    settings = Settings.model_construct(
        redis_url="redis://localhost:6379/0",
        database_url="postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        geetest_enabled=True,
        geetest_register_captcha_id="register-id",
        geetest_register_captcha_key=None,
        geetest_login_captcha_id="login-id",
        geetest_login_captcha_key="login-key",
        geetest_base_url="https://gcaptcha4.geetest.com",
    )
    verifier = GeeTestGT4Verifier(settings)

    with pytest.raises(GeeTestConfigurationError, match="SERVER_PY_GEETEST_REGISTER_CAPTCHA_KEY is required"):
        _run(verifier.verify(_captcha_payload(), scenario="register", remote_ip="127.0.0.1"))


def test_geetest_verifier_raises_on_http_error(monkeypatch: pytest.MonkeyPatch):
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
                json={"status": "error"},
            )

    monkeypatch.setattr("app.infrastructure.geetest_verifier.httpx.AsyncClient", StubAsyncClient)

    verifier = GeeTestGT4Verifier(_settings())

    with pytest.raises(GeeTestServiceUnavailableError, match="validation request failed"):
        _run(verifier.verify(_captcha_payload(), scenario="login", remote_ip="127.0.0.1"))
