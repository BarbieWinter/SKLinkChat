from __future__ import annotations

import asyncio
import logging

import httpx
import pytest

from app.infrastructure.email_sender import ResendEmailSender
from app.shared.config import Settings


def _run(coro):
    return asyncio.run(coro)


def _resend_settings() -> Settings:
    return Settings(
        redis_url="redis://localhost:6379/0",
        database_url="postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        email_provider="resend",
        resend_api_key="re_test_key",
        email_from="noreply@mail.sklinkchat.com",
        app_base_url="http://localhost:4173",
    )


def test_resend_email_sender_verification_code(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            captured["base_url"] = base_url

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
            captured["json"] = json
            captured["headers"] = headers
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://api.resend.com/emails"),
                json={"id": "email_123"},
            )

    monkeypatch.setattr("app.infrastructure.email_sender.httpx.AsyncClient", StubAsyncClient)

    sender = ResendEmailSender(_resend_settings())
    _run(
        sender.send_verification_code(
            recipient="user@example.com",
            display_name="Traveler",
            code="123456",
        )
    )

    assert captured["base_url"] == "https://api.resend.com"
    assert captured["headers"] == {"Authorization": "Bearer re_test_key"}
    assert captured["json"]["from"] == "noreply@mail.sklinkchat.com"
    assert captured["json"]["to"] == ["user@example.com"]
    assert captured["json"]["subject"] == "Your SKLinkChat verification code"
    assert "<strong>123456</strong>" in captured["json"]["html"]
    assert "123456" in captured["json"]["text"]


def test_resend_email_sender_password_reset(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
            captured["json"] = json
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://api.resend.com/emails"),
                json={"id": "email_456"},
            )

    monkeypatch.setattr("app.infrastructure.email_sender.httpx.AsyncClient", StubAsyncClient)

    sender = ResendEmailSender(_resend_settings())
    _run(
        sender.send_password_reset_email(
            recipient="user@example.com",
            display_name="Traveler",
            reset_link="http://localhost:4173/?reset_token=test-token",
        )
    )

    assert captured["json"]["subject"] == "Reset your SKLinkChat password"
    assert "reset_token=test-token" in captured["json"]["html"]


def test_resend_email_sender_logs_and_raises_on_http_failure(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
            return httpx.Response(
                500,
                request=httpx.Request("POST", f"{self.base_url}{path}"),
                json={"message": "internal"},
            )

    monkeypatch.setattr("app.infrastructure.email_sender.httpx.AsyncClient", StubAsyncClient)

    sender = ResendEmailSender(_resend_settings())
    caplog.set_level(logging.ERROR, logger="app.email")

    with pytest.raises(RuntimeError, match="Resend email request failed"):
        _run(
            sender.send_password_reset_email(
                recipient="user@example.com",
                display_name="Traveler",
                reset_link="http://localhost:4173/?reset_token=test-token",
            )
        )

    assert "resend email request failed" in caplog.text


def test_resend_email_sender_raises_on_missing_api_key():
    settings = Settings(
        redis_url="redis://localhost:6379/0",
        database_url="postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat",
        email_provider="fake",
        resend_api_key=None,
        email_from="noreply@mail.sklinkchat.com",
        app_base_url="http://localhost:4173",
    )

    sender = ResendEmailSender(settings)

    with pytest.raises(RuntimeError, match="SERVER_PY_RESEND_API_KEY is required"):
        _run(
            sender.send_verification_code(
                recipient="user@example.com",
                display_name="Traveler",
                code="123456",
            )
        )


def test_resend_email_sender_raises_on_transport_error(monkeypatch: pytest.MonkeyPatch):
    class StubAsyncClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, path: str, *, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

    monkeypatch.setattr("app.infrastructure.email_sender.httpx.AsyncClient", StubAsyncClient)

    sender = ResendEmailSender(_resend_settings())

    with pytest.raises(RuntimeError, match="Resend email transport failed"):
        _run(
            sender.send_verification_code(
                recipient="user@example.com",
                display_name="Traveler",
                code="123456",
            )
        )
