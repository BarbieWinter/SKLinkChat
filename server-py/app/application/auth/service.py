from __future__ import annotations

import re
from dataclasses import dataclass
from email.utils import parseaddr

from app.application.auth.security import hash_password, hash_secret, issue_token, make_expiry, utc_now
from app.infrastructure.postgres.models import Account
from app.infrastructure.postgres.repositories import AccountRepository, AuthSessionRepository
from app.infrastructure.stack_auth_client import StackAuthClient, StackUserProfile
from app.shared.errors import AppError


def normalize_email(email: str) -> tuple[str, str]:
    parsed_email = parseaddr(email)[1].strip()
    if "@" not in parsed_email:
        raise AppError(message="Email is invalid", code="INVALID_EMAIL", status_code=422)
    return parsed_email, parsed_email.lower()


def normalize_display_name(display_name: str) -> str:
    normalized = display_name.strip()
    if not normalized:
        raise AppError(message="Username is required", code="DISPLAY_NAME_REQUIRED", status_code=422)
    if len(normalized) > 80:
        raise AppError(message="Username is too long", code="DISPLAY_NAME_TOO_LONG", status_code=422)
    return normalized


def normalize_interests(interests: list[str]) -> list[str]:
    normalized = sorted({value.strip() for value in interests if value.strip()})
    return normalized[:10]


def normalize_gender(gender: str | None) -> str:
    normalized = (gender or "unknown").strip().lower()
    if normalized not in {"male", "female", "unknown"}:
        raise AppError(message="Gender is invalid", code="INVALID_GENDER", status_code=422)
    return normalized


@dataclass(slots=True, frozen=True)
class AuthSessionView:
    authenticated: bool
    email_verified: bool = False
    display_name: str | None = None
    short_id: str | None = None
    interests: list[str] | None = None
    gender: str = "unknown"
    is_admin: bool = False
    chat_access_restricted: bool = False


@dataclass(slots=True, frozen=True)
class AuthTokenBundle:
    raw_session_token: str
    auth_session: AuthSessionView


class AuthService:
    def __init__(
        self,
        *,
        account_repository: AccountRepository,
        auth_session_repository: AuthSessionRepository,
        auth_session_ttl_seconds: int,
        stack_auth_enabled: bool = False,
        stack_auth_client: StackAuthClient | None = None,
    ) -> None:
        self._account_repository = account_repository
        self._auth_session_repository = auth_session_repository
        self._auth_session_ttl_seconds = auth_session_ttl_seconds
        self._stack_auth_enabled = stack_auth_enabled
        self._stack_auth_client = stack_auth_client

    async def logout(self, *, raw_session_token: str | None) -> None:
        if not raw_session_token:
            return
        await self._auth_session_repository.delete_by_token_hash(hash_secret(raw_session_token))

    async def get_session_view(
        self,
        *,
        raw_session_token: str | None,
        stack_access_token: str | None = None,
    ) -> tuple[str | None, AuthSessionView]:
        if raw_session_token:
            account_id = await self._auth_session_repository.get_active_account_id(
                hash_secret(raw_session_token),
                utc_now(),
            )
            if account_id is not None:
                account = await self._account_repository.get_by_id(account_id)
                if account is not None:
                    return account.id, await self._build_session_view(account)

        if self._stack_auth_enabled and self._stack_auth_client is not None:
            return await self._resolve_stack_session_view(stack_access_token)

        return None, AuthSessionView(authenticated=False)

    async def create_session_for_account_id(self, account_id: str) -> AuthTokenBundle:
        account = await self._require_account(account_id)
        return await self._create_authenticated_session(account)

    async def _create_authenticated_session(self, account: Account) -> AuthTokenBundle:
        raw_session_token = issue_token()
        await self._auth_session_repository.create(
            account_id=account.id,
            token_hash=hash_secret(raw_session_token),
            expires_at=make_expiry(self._auth_session_ttl_seconds),
        )
        return AuthTokenBundle(
            raw_session_token=raw_session_token,
            auth_session=await self._build_session_view(account),
        )

    async def _build_session_view(self, account: Account) -> AuthSessionView:
        interests = await self._account_repository.list_interests(account.id)
        return AuthSessionView(
            authenticated=True,
            email_verified=account.email_verified_at is not None,
            display_name=account.display_name,
            short_id=account.short_id,
            interests=interests,
            gender=normalize_gender(account.gender),
            is_admin=account.is_admin,
            chat_access_restricted=getattr(account, "chat_access_restricted_at", None) is not None,
        )

    async def _require_account(self, account_id: str) -> Account:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        return account

    async def _resolve_stack_session_view(self, access_token: str | None) -> tuple[str | None, AuthSessionView]:
        profile = await self._stack_auth_client.get_user_by_access_token(access_token)
        if profile is None:
            return None, AuthSessionView(authenticated=False)

        account = await self._resolve_stack_account(profile)
        return account.id, await self._build_session_view(account)

    async def _resolve_stack_account(self, profile: StackUserProfile) -> Account:
        account = await self._account_repository.get_by_stack_user_id(profile.stack_user_id)
        try:
            normalized_email = normalize_email(profile.primary_email)[1] if profile.primary_email else None
        except AppError as error:
            raise AppError(
                message="Stack account does not provide a valid email",
                code="STACK_EMAIL_REQUIRED",
                status_code=401,
            ) from error
        verified_at = utc_now() if profile.primary_email_verified else None

        if account is not None:
            maybe_existing = None
            if normalized_email is not None:
                maybe_existing = await self._account_repository.get_by_email_normalized(normalized_email)
            if maybe_existing is not None and maybe_existing.id != account.id:
                return account
            return await self._account_repository.sync_stack_profile(
                account_id=account.id,
                email=profile.primary_email,
                email_normalized=normalized_email,
                email_verified_at=verified_at,
            )

        if normalized_email is None or profile.primary_email is None:
            raise AppError(
                message="Stack account does not provide a valid email",
                code="STACK_EMAIL_REQUIRED",
                status_code=401,
            )

        matched_by_email = await self._account_repository.get_by_email_normalized(normalized_email)
        if matched_by_email is not None:
            if matched_by_email.stack_user_id and matched_by_email.stack_user_id != profile.stack_user_id:
                if verified_at is None:
                    raise AppError(
                        message="This account is already linked to another identity",
                        code="STACK_ACCOUNT_CONFLICT",
                        status_code=409,
                    )
            return await self._account_repository.bind_stack_user(
                account_id=matched_by_email.id,
                stack_user_id=profile.stack_user_id,
                email=profile.primary_email,
                email_normalized=normalized_email,
                email_verified_at=verified_at,
            )

        base_display_name = await self._allocate_stack_display_name(profile)
        for index in range(1, 31):
            try:
                return await self._account_repository.create(
                    email=profile.primary_email,
                    email_normalized=normalized_email,
                    password_hash=hash_password(issue_token(24)),
                    display_name=self._next_display_name_candidate(base_display_name, index),
                    interests=[],
                    stack_user_id=profile.stack_user_id,
                    email_verified_at=verified_at,
                    gender="unknown",
                )
            except ValueError as error:
                if str(error) != "display_name_conflict":
                    raise
        raise AppError(message="Unable to allocate display name", code="DISPLAY_NAME_CONFLICT", status_code=409)

    async def _allocate_stack_display_name(self, profile: StackUserProfile) -> str:
        for candidate in self._iter_stack_display_name_candidates(profile):
            try:
                return normalize_display_name(candidate)
            except AppError:
                continue
        raise AppError(message="Username is required", code="DISPLAY_NAME_REQUIRED", status_code=422)

    def _iter_stack_display_name_candidates(self, profile: StackUserProfile):
        if profile.display_name:
            yield profile.display_name
        if profile.primary_email:
            yield profile.primary_email.split("@", 1)[0]
        yield f"user-{profile.stack_user_id[:8]}"

    def _next_display_name_candidate(self, base: str, index: int) -> str:
        if index <= 1:
            return base
        suffix = f"-{index}"
        normalized = re.sub(r"\s+", "-", base.strip())
        if len(normalized) + len(suffix) > 80:
            normalized = normalized[: 80 - len(suffix)]
        return f"{normalized}{suffix}"
