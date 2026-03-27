from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from email.utils import parseaddr
from uuid import uuid4

from app.application.auth.security import (
    ensure_utc,
    generate_verification_code,
    hash_ip,
    hash_password,
    hash_secret,
    issue_token,
    make_expiry,
    utc_now,
    verify_password,
)
from app.application.platform.services import (
    EmailSender,
    RiskEventRecorder,
    TurnstileConfigurationError,
    TurnstileServiceUnavailableError,
    TurnstileVerifier,
)
from app.infrastructure.postgres.models import Account
from app.infrastructure.postgres.repositories import (
    AccountRepository,
    AuthSessionRepository,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
)
from app.shared.errors import AppError


def normalize_email(email: str) -> tuple[str, str]:
    parsed_email = parseaddr(email)[1].strip()
    if "@" not in parsed_email:
        raise AppError(message="Email is invalid", code="INVALID_EMAIL", status_code=422)
    return parsed_email, parsed_email.lower()


_BLOCKED_EMAIL_DOMAINS: frozenset[str] = frozenset({
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "test.org",
    "invalid.com",
    "localhost",
    "mailinator.com",
    "guerrillamail.com",
    "tempmail.com",
    "throwaway.email",
    "yopmail.com",
    "sharklasers.com",
    "guerrillamailblock.com",
    "grr.la",
    "dispostable.com",
    "trashmail.com",
})


def check_email_domain(email_normalized: str) -> None:
    domain = email_normalized.rsplit("@", 1)[-1]
    if domain in _BLOCKED_EMAIL_DOMAINS:
        raise AppError(
            message="This email domain is not allowed",
            code="EMAIL_DOMAIN_BLOCKED",
            status_code=422,
        )


def normalize_display_name(display_name: str) -> str:
    normalized = display_name.strip()
    if not normalized:
        raise AppError(message="Display name is required", code="DISPLAY_NAME_REQUIRED", status_code=422)
    if len(normalized) > 80:
        raise AppError(message="Display name is too long", code="DISPLAY_NAME_TOO_LONG", status_code=422)
    return normalized


def normalize_interests(interests: list[str]) -> list[str]:
    normalized = sorted({value.strip() for value in interests if value.strip()})
    return normalized[:10]


def _mask_email(email: str) -> str:
    local, domain = email.rsplit("@", 1)
    if len(local) <= 1:
        return f"*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 1)}@{domain}"


_VERIFICATION_MAX_ATTEMPTS = 5
_RESEND_VERIFICATION_MIN_DELAY_SECONDS = 0.35
_PASSWORD_RESET_MIN_DELAY_SECONDS = 0.35


@dataclass(slots=True, frozen=True)
class AuthSessionView:
    authenticated: bool
    email_verified: bool = False
    display_name: str | None = None
    short_id: str | None = None
    interests: list[str] | None = None
    is_admin: bool = False
    chat_access_restricted: bool = False


@dataclass(slots=True, frozen=True)
class AuthTokenBundle:
    raw_session_token: str
    auth_session: AuthSessionView


@dataclass(slots=True, frozen=True)
class RegistrationResult:
    status: str
    masked_email: str


class AuthService:
    def __init__(
        self,
        *,
        account_repository: AccountRepository,
        auth_session_repository: AuthSessionRepository,
        verification_token_repository: EmailVerificationTokenRepository,
        password_reset_token_repository: PasswordResetTokenRepository,
        risk_event_recorder: RiskEventRecorder,
        email_sender: EmailSender,
        turnstile_verifier: TurnstileVerifier,
        verification_token_ttl_seconds: int,
        auth_session_ttl_seconds: int,
        verification_resend_cooldown_seconds: int,
        verification_resend_hourly_limit: int,
        password_reset_token_ttl_seconds: int,
        password_reset_resend_cooldown_seconds: int,
        password_reset_hourly_limit: int,
        app_base_url: str,
    ) -> None:
        self._account_repository = account_repository
        self._auth_session_repository = auth_session_repository
        self._verification_token_repository = verification_token_repository
        self._password_reset_token_repository = password_reset_token_repository
        self._risk_event_recorder = risk_event_recorder
        self._email_sender = email_sender
        self._turnstile_verifier = turnstile_verifier
        self._verification_token_ttl_seconds = verification_token_ttl_seconds
        self._auth_session_ttl_seconds = auth_session_ttl_seconds
        self._verification_resend_cooldown_seconds = verification_resend_cooldown_seconds
        self._verification_resend_hourly_limit = verification_resend_hourly_limit
        self._password_reset_token_ttl_seconds = password_reset_token_ttl_seconds
        self._password_reset_resend_cooldown_seconds = password_reset_resend_cooldown_seconds
        self._password_reset_hourly_limit = password_reset_hourly_limit
        self._app_base_url = app_base_url.rstrip("/")

    async def register(
        self,
        *,
        email: str,
        password: str,
        display_name: str,
        interests: list[str],
        turnstile_token: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> RegistrationResult:
        if len(password) < 8:
            raise AppError(message="Password is too short", code="PASSWORD_TOO_SHORT", status_code=422)

        email, email_normalized = normalize_email(email)
        check_email_domain(email_normalized)
        display_name = normalize_display_name(display_name)
        interests = normalize_interests(interests)
        turnstile_result = await self._verify_turnstile_or_raise(turnstile_token=turnstile_token, ip_address=ip_address)

        existing_account = await self._account_repository.get_by_email_normalized(email_normalized)
        if existing_account is not None:
            if existing_account.email_verified_at is not None:
                await self._risk_event_recorder.record(
                    email_normalized=email_normalized,
                    outcome="duplicate_email",
                    details={"provider": turnstile_result.provider},
                    account_id=existing_account.id,
                    ip_hash=hash_ip(ip_address),
                    user_agent=user_agent,
                )
                raise AppError(message="Email is already registered", code="EMAIL_ALREADY_EXISTS", status_code=409)

            await self._account_repository.update_password(
                account_id=existing_account.id,
                password_hash=hash_password(password),
            )
            await self._account_repository.update_profile(
                account_id=existing_account.id,
                display_name=display_name,
                interests=interests,
            )
            account = existing_account
        else:
            account = await self._account_repository.create(
                email=email,
                email_normalized=email_normalized,
                password_hash=hash_password(password),
                display_name=display_name,
                interests=interests,
            )
            await self._risk_event_recorder.record(
                email_normalized=email_normalized,
                outcome="registered",
                details={"provider": turnstile_result.provider},
                account_id=account.id,
                ip_hash=hash_ip(ip_address),
                user_agent=user_agent,
            )

        await self._issue_verification_code(account)
        return RegistrationResult(status="verification_required", masked_email=_mask_email(account.email))

    async def login(
        self,
        *,
        email: str,
        password: str,
        turnstile_token: str,
        ip_address: str | None,
    ) -> AuthTokenBundle | RegistrationResult:
        await self._verify_turnstile_or_raise(turnstile_token=turnstile_token, ip_address=ip_address)
        _, email_normalized = normalize_email(email)
        account = await self._account_repository.get_by_email_normalized(email_normalized)
        if account is None or not verify_password(password, account.password_hash):
            raise AppError(message="Invalid credentials", code="INVALID_CREDENTIALS", status_code=401)

        if account.email_verified_at is None:
            await self._issue_verification_code(account, enforce_rate_limits=True)
            return RegistrationResult(status="verification_required", masked_email=_mask_email(account.email))

        return await self._create_authenticated_session(account)

    async def logout(self, *, raw_session_token: str | None) -> None:
        if not raw_session_token:
            return
        await self._auth_session_repository.delete_by_token_hash(hash_secret(raw_session_token))

    async def get_session_view(self, *, raw_session_token: str | None) -> tuple[str | None, AuthSessionView]:
        if not raw_session_token:
            return None, AuthSessionView(authenticated=False)

        account_id = await self._auth_session_repository.get_active_account_id(
            hash_secret(raw_session_token),
            utc_now(),
        )
        if account_id is None:
            return None, AuthSessionView(authenticated=False)

        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            return None, AuthSessionView(authenticated=False)
        return account.id, await self._build_session_view(account)

    async def verify_code(self, *, email: str, code: str) -> AuthTokenBundle:
        _, email_normalized = normalize_email(email)
        account = await self._account_repository.get_by_email_normalized(email_normalized)
        if account is None:
            raise AppError(message="Verification code is invalid", code="INVALID_VERIFICATION_CODE", status_code=400)

        now = utc_now()
        token = await self._verification_token_repository.get_active_for_account(account.id, now)
        if token is None:
            raise AppError(
                message="No pending verification code, please request a new one",
                code="NO_PENDING_VERIFICATION",
                status_code=400,
            )

        if token.account_id != account.id:
            await self._verification_token_repository.revoke(token_id=token.id, revoked_at=now)
            raise AppError(message="Verification code is invalid", code="INVALID_VERIFICATION_CODE", status_code=400)

        if token.attempts >= _VERIFICATION_MAX_ATTEMPTS:
            await self._verification_token_repository.revoke(token_id=token.id, revoked_at=now)
            raise AppError(
                message="Too many failed attempts, please request a new code",
                code="VERIFICATION_MAX_ATTEMPTS",
                status_code=429,
            )

        expected_hash = hash_secret(f"{token.id}:{code}")
        if token.token_hash != expected_hash:
            attempts = await self._verification_token_repository.record_failed_attempt(
                token_id=token.id,
                failed_at=now,
                max_attempts=_VERIFICATION_MAX_ATTEMPTS,
            )
            if attempts >= _VERIFICATION_MAX_ATTEMPTS:
                raise AppError(
                    message="Too many failed attempts, please request a new code",
                    code="VERIFICATION_MAX_ATTEMPTS",
                    status_code=429,
                )
            raise AppError(message="Verification code is invalid", code="INVALID_VERIFICATION_CODE", status_code=400)

        await self._verification_token_repository.consume(token_id=token.id, consumed_at=now)
        account = await self._account_repository.mark_verified(account_id=account.id, verified_at=now)
        return await self._create_authenticated_session(account)

    async def resend_verification(self, *, email: str, turnstile_token: str, ip_address: str | None) -> None:
        started_at = asyncio.get_running_loop().time()
        try:
            await self._verify_turnstile_or_raise(turnstile_token=turnstile_token, ip_address=ip_address)
            try:
                _, email_normalized = normalize_email(email)
            except AppError:
                return

            account = await self._account_repository.get_by_email_normalized(email_normalized)
            if account is None or account.email_verified_at is not None:
                return

            await self._issue_verification_code(account, enforce_rate_limits=True)
        finally:
            await self._apply_resend_verification_delay(started_at)

    async def _verify_turnstile_or_raise(
        self,
        *,
        turnstile_token: str,
        ip_address: str | None,
    ):
        if not turnstile_token.strip():
            raise AppError(
                message="Turnstile token is required",
                code="TURNSTILE_TOKEN_REQUIRED",
                status_code=400,
            )

        try:
            result = await self._turnstile_verifier.verify(turnstile_token, remote_ip=ip_address)
        except TurnstileConfigurationError as error:
            raise AppError(
                message=str(error),
                code="TURNSTILE_NOT_CONFIGURED",
                status_code=500,
            ) from error
        except TurnstileServiceUnavailableError as error:
            raise AppError(
                message="Turnstile validation is temporarily unavailable",
                code="TURNSTILE_UNAVAILABLE",
                status_code=503,
            ) from error

        if not result.success:
            raise AppError(
                message="Turnstile validation failed",
                code="TURNSTILE_VALIDATION_FAILED",
                status_code=400,
            )

        return result

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
            is_admin=account.is_admin,
            chat_access_restricted=getattr(account, "chat_access_restricted_at", None) is not None,
        )

    async def _issue_verification_code(self, account: Account, *, enforce_rate_limits: bool = False) -> None:
        now = utc_now()
        if enforce_rate_limits:
            await self._ensure_verification_code_send_allowed(account.id, now)

        code = generate_verification_code()
        token_id = str(uuid4())
        await self._verification_token_repository.revoke_active_for_account(
            account_id=account.id,
            revoked_at=now,
        )
        await self._verification_token_repository.create(
            account_id=account.id,
            token_id=token_id,
            token_hash=hash_secret(f"{token_id}:{code}"),
            expires_at=make_expiry(self._verification_token_ttl_seconds),
        )
        await self._email_sender.send_verification_code(
            recipient=account.email,
            display_name=account.display_name,
            code=code,
        )

    async def _ensure_verification_code_send_allowed(self, account_id: str, now) -> None:
        latest_created_at = await self._verification_token_repository.latest_created_at(account_id)
        if (
            latest_created_at is not None
            and (now - ensure_utc(latest_created_at)).total_seconds() < self._verification_resend_cooldown_seconds
        ):
            raise AppError(
                message="Verification code was sent too recently",
                code="VERIFICATION_CODE_COOLDOWN",
                status_code=429,
            )

        sent_last_hour = await self._verification_token_repository.sent_count_since(
            account_id,
            now - timedelta(hours=1),
        )
        if sent_last_hour >= self._verification_resend_hourly_limit:
            raise AppError(
                message="Verification code rate limit exceeded",
                code="VERIFICATION_CODE_RATE_LIMITED",
                status_code=429,
            )

    async def _apply_resend_verification_delay(self, started_at: float) -> None:
        remaining = _RESEND_VERIFICATION_MIN_DELAY_SECONDS - (asyncio.get_running_loop().time() - started_at)
        if remaining > 0:
            await asyncio.sleep(remaining)

    async def _require_account(self, account_id: str) -> Account:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        return account

    async def request_password_reset(self, *, email: str) -> None:
        started_at = asyncio.get_running_loop().time()
        try:
            try:
                _, email_normalized = normalize_email(email)
            except AppError:
                return

            account = await self._account_repository.get_by_email_normalized(email_normalized)
            if account is None:
                return

            now = utc_now()
            latest_created_at = await self._password_reset_token_repository.latest_created_at(account.id)
            if (
                latest_created_at is not None
                and (now - ensure_utc(latest_created_at)).total_seconds() < self._password_reset_resend_cooldown_seconds
            ):
                return

            sent_last_hour = await self._password_reset_token_repository.sent_count_since(
                account.id,
                now - timedelta(hours=1),
            )
            if sent_last_hour >= self._password_reset_hourly_limit:
                return

            raw_token = issue_token()
            await self._password_reset_token_repository.revoke_active_for_account(
                account_id=account.id,
                revoked_at=now,
            )
            await self._password_reset_token_repository.create(
                account_id=account.id,
                token_hash=hash_secret(raw_token),
                expires_at=make_expiry(self._password_reset_token_ttl_seconds),
            )
            await self._email_sender.send_password_reset_email(
                recipient=account.email,
                display_name=account.display_name,
                reset_link=f"{self._app_base_url}/?reset_token={raw_token}",
            )
        finally:
            await self._apply_password_reset_delay(started_at)

    async def reset_password(self, *, raw_token: str, new_password: str) -> None:
        if len(new_password) < 8:
            raise AppError(message="Password is too short", code="PASSWORD_TOO_SHORT", status_code=422)

        token = await self._password_reset_token_repository.get_by_token_hash(hash_secret(raw_token))
        if token is None:
            raise AppError(message="Reset link is invalid", code="INVALID_RESET_TOKEN", status_code=400)
        if token.consumed_at is not None:
            raise AppError(message="Reset link is invalid", code="INVALID_RESET_TOKEN", status_code=400)
        if token.revoked_at is not None:
            raise AppError(message="Reset link is invalid", code="INVALID_RESET_TOKEN", status_code=400)
        if ensure_utc(token.expires_at) <= utc_now():
            raise AppError(message="Reset link has expired", code="RESET_LINK_EXPIRED", status_code=410)

        await self._password_reset_token_repository.consume(token_id=token.id, consumed_at=utc_now())

        account = await self._account_repository.get_by_id(token.account_id)
        if account is None:
            raise AppError(message="Account not found", code="ACCOUNT_NOT_FOUND", status_code=404)

        await self._account_repository.update_password(
            account_id=account.id,
            password_hash=hash_password(new_password),
        )
        await self._auth_session_repository.delete_by_account_id(account.id)

    async def _apply_password_reset_delay(self, started_at: float) -> None:
        remaining = _PASSWORD_RESET_MIN_DELAY_SECONDS - (asyncio.get_running_loop().time() - started_at)
        if remaining > 0:
            await asyncio.sleep(remaining)
