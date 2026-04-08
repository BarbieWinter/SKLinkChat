from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.shared.errors import AppError


@dataclass(slots=True, frozen=True)
class StackUserProfile:
    stack_user_id: str
    primary_email: str | None
    primary_email_verified: bool
    display_name: str | None


class StackAuthClient:
    def __init__(
        self,
        *,
        project_id: str,
        secret_server_key: str,
        api_base_url: str = "https://api.stack-auth.com",
        timeout_seconds: float = 8.0,
    ) -> None:
        self._project_id = project_id
        self._secret_server_key = secret_server_key
        self._api_base_url = api_base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    async def get_user_by_access_token(self, access_token: str | None) -> StackUserProfile | None:
        token = (access_token or "").strip()
        if not token:
            return None

        url = f"{self._api_base_url}/api/v1/users/me"
        headers = {
            "x-stack-project-id": self._project_id,
            "x-stack-secret-server-key": self._secret_server_key,
            "x-stack-access-token": token,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.get(url, headers=headers)
        except httpx.HTTPError as error:
            raise AppError(
                message="Stack Auth service is temporarily unavailable",
                code="STACK_AUTH_UNAVAILABLE",
                status_code=503,
            ) from error

        if response.status_code in {401, 403}:
            return None
        if response.status_code >= 500:
            raise AppError(
                message="Stack Auth service is temporarily unavailable",
                code="STACK_AUTH_UNAVAILABLE",
                status_code=503,
            )
        if response.status_code >= 400:
            raise AppError(
                message="Stack Auth token is invalid",
                code="STACK_AUTH_INVALID",
                status_code=401,
            )

        payload = response.json()
        stack_user_id = str(payload.get("id") or "").strip()
        if not stack_user_id:
            return None

        raw_email = payload.get("primaryEmail")
        if raw_email is None:
            raw_email = payload.get("primary_email")
        primary_email = str(raw_email).strip() if isinstance(raw_email, str) else None

        raw_verified = payload.get("primaryEmailVerified")
        if raw_verified is None:
            raw_verified = payload.get("primary_email_verified")
        primary_email_verified = bool(raw_verified)

        raw_display_name = payload.get("displayName")
        if raw_display_name is None:
            raw_display_name = payload.get("display_name")
        display_name = str(raw_display_name).strip() if isinstance(raw_display_name, str) else None

        return StackUserProfile(
            stack_user_id=stack_user_id,
            primary_email=primary_email,
            primary_email_verified=primary_email_verified,
            display_name=display_name,
        )
