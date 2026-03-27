from __future__ import annotations

import logging

import httpx

from app.application.platform.services import (
    TurnstileConfigurationError,
    TurnstileServiceUnavailableError,
    TurnstileVerificationResult,
)
from app.shared.config import Settings

logger = logging.getLogger("app.turnstile")


class DisabledTurnstileVerifier:
    async def verify(self, token: str, *, remote_ip: str | None) -> TurnstileVerificationResult:
        _ = token, remote_ip
        return TurnstileVerificationResult(success=True, provider="disabled")


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
            raise TurnstileConfigurationError(
                "SERVER_PY_TURNSTILE_SECRET_KEY is required when SERVER_PY_TURNSTILE_ENABLED=true"
            )

        try:
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
        except httpx.HTTPStatusError as error:
            logger.error(
                "turnstile siteverify request failed",
                extra={"provider": "cloudflare", "status_code": error.response.status_code},
            )
            raise TurnstileServiceUnavailableError("Cloudflare Turnstile validation request failed") from error
        except httpx.HTTPError as error:
            logger.exception("turnstile siteverify transport failed", extra={"provider": "cloudflare"})
            raise TurnstileServiceUnavailableError("Cloudflare Turnstile validation transport failed") from error

        return TurnstileVerificationResult(
            success=bool(payload.get("success")),
            provider="cloudflare",
            error_codes=tuple(payload.get("error-codes", [])),
        )


def build_turnstile_verifier(settings: Settings):
    if not settings.turnstile_enabled:
        logger.info("turnstile validation disabled", extra={"provider": "disabled"})
        return DisabledTurnstileVerifier()
    if settings.turnstile_site_key is None:
        raise TurnstileConfigurationError(
            "SERVER_PY_TURNSTILE_SITE_KEY is required when SERVER_PY_TURNSTILE_ENABLED=true"
        )
    if settings.turnstile_secret_key is None:
        raise TurnstileConfigurationError(
            "SERVER_PY_TURNSTILE_SECRET_KEY is required when SERVER_PY_TURNSTILE_ENABLED=true"
        )
    logger.info("using cloudflare turnstile verifier", extra={"provider": "cloudflare"})
    return CloudflareTurnstileVerifier(settings)
