from __future__ import annotations

import logging

import httpx

from app.application.platform.services import TurnstileVerificationResult
from app.shared.config import Settings

logger = logging.getLogger("app.turnstile")


class FakeTurnstileVerifier:
    def __init__(self, *, always_pass: bool = True) -> None:
        self._always_pass = always_pass

    async def verify(self, token: str, *, remote_ip: str | None) -> TurnstileVerificationResult:
        _ = remote_ip
        if self._always_pass and token.strip():
            return TurnstileVerificationResult(success=True, provider="fake")
        return TurnstileVerificationResult(
            success=False,
            provider="fake",
            error_codes=("invalid-input-response",),
        )


class CloudflareTurnstileVerifier:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def verify(self, token: str, *, remote_ip: str | None) -> TurnstileVerificationResult:
        if not self._settings.turnstile_secret_key:
            raise RuntimeError("SERVER_PY_TURNSTILE_SECRET_KEY is required for cloudflare turnstile provider")

        async with httpx.AsyncClient(base_url=self._settings.turnstile_base_url, timeout=10.0) as client:
            response = await client.post(
                "/turnstile/v0/siteverify",
                data={
                    "secret": self._settings.turnstile_secret_key,
                    "response": token,
                    "remoteip": remote_ip or "",
                },
            )
            response.raise_for_status()
            payload = response.json()
            return TurnstileVerificationResult(
                success=bool(payload.get("success")),
                provider="cloudflare",
                error_codes=tuple(payload.get("error-codes", [])),
            )


def build_turnstile_verifier(settings: Settings):
    if settings.turnstile_provider == "cloudflare":
        return CloudflareTurnstileVerifier(settings)
    logger.info("using fake turnstile verifier", extra={"provider": "fake"})
    return FakeTurnstileVerifier(always_pass=settings.fake_turnstile_always_pass)
