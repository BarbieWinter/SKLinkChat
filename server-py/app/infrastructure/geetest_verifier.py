from __future__ import annotations

import hashlib
import hmac
import logging

import httpx

from app.application.platform.services import (
    CaptchaScenario,
    GeeTestCaptchaPayload,
    GeeTestConfigurationError,
    GeeTestServiceUnavailableError,
    GeeTestVerificationResult,
)
from app.shared.config import Settings

logger = logging.getLogger("app.geetest")


class DisabledGeeTestVerifier:
    async def verify(
        self,
        payload: GeeTestCaptchaPayload,
        *,
        scenario: CaptchaScenario,
        remote_ip: str | None,
    ) -> GeeTestVerificationResult:
        _ = payload, remote_ip
        return GeeTestVerificationResult(success=True, provider="disabled", scenario=scenario)


class GeeTestGT4Verifier:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _resolve_credentials(self, scenario: CaptchaScenario) -> tuple[str, str]:
        if scenario in {"register", "resend_verification"}:
            captcha_id = self._settings.geetest_register_captcha_id
            captcha_key = self._settings.geetest_register_captcha_key
            id_env = "SERVER_PY_GEETEST_REGISTER_CAPTCHA_ID"
            key_env = "SERVER_PY_GEETEST_REGISTER_CAPTCHA_KEY"
        else:
            captcha_id = self._settings.geetest_login_captcha_id
            captcha_key = self._settings.geetest_login_captcha_key
            id_env = "SERVER_PY_GEETEST_LOGIN_CAPTCHA_ID"
            key_env = "SERVER_PY_GEETEST_LOGIN_CAPTCHA_KEY"

        if not captcha_id:
            raise GeeTestConfigurationError(f"{id_env} is required when SERVER_PY_GEETEST_ENABLED=true")
        if not captcha_key:
            raise GeeTestConfigurationError(f"{key_env} is required when SERVER_PY_GEETEST_ENABLED=true")

        return captcha_id, captcha_key

    async def verify(
        self,
        payload: GeeTestCaptchaPayload,
        *,
        scenario: CaptchaScenario,
        remote_ip: str | None,
    ) -> GeeTestVerificationResult:
        captcha_id, captcha_key = self._resolve_credentials(scenario)
        sign_token = hmac.new(
            captcha_key.encode("utf-8"),
            payload.lot_number.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

        try:
            async with httpx.AsyncClient(base_url=self._settings.geetest_base_url, timeout=10.0) as client:
                response = await client.post(
                    f"/validate?captcha_id={captcha_id}",
                    data={
                        "lot_number": payload.lot_number,
                        "captcha_output": payload.captcha_output,
                        "pass_token": payload.pass_token,
                        "gen_time": payload.gen_time,
                        "sign_token": sign_token,
                        "ip_address": remote_ip or "",
                    },
                )
                response.raise_for_status()
                result_payload = response.json()
        except httpx.HTTPStatusError as error:
            logger.error(
                "geetest validate request failed",
                extra={"provider": "geetest", "status_code": error.response.status_code, "scenario": scenario},
            )
            raise GeeTestServiceUnavailableError("GeeTest validation request failed") from error
        except httpx.HTTPError as error:
            logger.exception("geetest validate transport failed", extra={"provider": "geetest", "scenario": scenario})
            raise GeeTestServiceUnavailableError("GeeTest validation transport failed") from error

        error_codes = tuple(
            str(value)
            for value in (result_payload.get("reason"), result_payload.get("msg"), result_payload.get("code"))
            if value not in (None, "")
        )

        return GeeTestVerificationResult(
            success=result_payload.get("status") == "success" and result_payload.get("result") == "success",
            provider="geetest",
            scenario=scenario,
            error_codes=error_codes,
        )


def build_geetest_verifier(settings: Settings):
    if not settings.geetest_enabled:
        logger.info("geetest validation disabled", extra={"provider": "disabled"})
        return DisabledGeeTestVerifier()

    logger.info("using geetest gt4 verifier", extra={"provider": "geetest"})
    return GeeTestGT4Verifier(settings)
