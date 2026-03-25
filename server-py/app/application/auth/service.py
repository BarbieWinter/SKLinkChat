from __future__ import annotations

from dataclasses import dataclass
from email.utils import parseaddr

from app.application.auth.security import (
    ensure_utc,
    hash_ip,
    hash_password,
    hash_secret,
    issue_token,
    make_expiry,
    utc_now,
    verify_password,
)
from app.application.platform.services import EmailSender, RiskEventRecorder, TurnstileVerifier
from app.infrastructure.postgres.models import Account
from app.infrastructure.postgres.repositories import (
    AccountRepository,
    AuthSessionRepository,
    EmailVerificationTokenRepository,
)
from app.shared.errors import AppError


def normalize_email(email: str) -> tuple[str, str]:
    parsed_email = parseaddr(email)[1].strip()
    if "@" not in parsed_email:
        raise AppError(message="Email is invalid", code="INVALID_EMAIL", status_code=422)
    return parsed_email, parsed_email.lower()


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


@dataclass(slots=True, frozen=True)
class AuthSessionView:
    authenticated: bool
    email_verified: bool = False
    display_name: str | None = None
    interests: list[str] | None = None


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
        verification_token_repository: EmailVerificationTokenRepository,
        risk_event_recorder: RiskEventRecorder,
        email_sender: EmailSender,
        turnstile_verifier: TurnstileVerifier,
        verification_token_ttl_seconds: int,
        auth_session_ttl_seconds: int,
        verification_resend_cooldown_seconds: int,
        verification_resend_hourly_limit: int,
        frontend_base_url: str,
    ) -> None:
        self._account_repository = account_repository
        self._auth_session_repository = auth_session_repository
        self._verification_token_repository = verification_token_repository
        self._risk_event_recorder = risk_event_recorder
        self._email_sender = email_sender
        self._turnstile_verifier = turnstile_verifier
        self._verification_token_ttl_seconds = verification_token_ttl_seconds
        self._auth_session_ttl_seconds = auth_session_ttl_seconds
        self._verification_resend_cooldown_seconds = verification_resend_cooldown_seconds
        self._verification_resend_hourly_limit = verification_resend_hourly_limit
        self._frontend_base_url = frontend_base_url.rstrip("/")

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
    ) -> AuthTokenBundle:
        if len(password) < 8:
            raise AppError(message="Password is too short", code="PASSWORD_TOO_SHORT", status_code=422)

        email, email_normalized = normalize_email(email)
        display_name = normalize_display_name(display_name)
        interests = normalize_interests(interests)
        turnstile_result = await self._turnstile_verifier.verify(turnstile_token, remote_ip=ip_address)
        if not turnstile_result.success:
            await self._risk_event_recorder.record(
                email_normalized=email_normalized,
                outcome="turnstile_failed",
                details={"provider": turnstile_result.provider, "error_codes": list(turnstile_result.error_codes)},
                account_id=None,
                ip_hash=hash_ip(ip_address),
                user_agent=user_agent,
            )
            raise AppError(
                message="Turnstile validation failed",
                code="TURNSTILE_VALIDATION_FAILED",
                status_code=400,
            )

        existing_account = await self._account_repository.get_by_email_normalized(email_normalized)
        if existing_account is not None:
            await self._risk_event_recorder.record(
                email_normalized=email_normalized,
                outcome="duplicate_email",
                details={"provider": turnstile_result.provider},
                account_id=existing_account.id,
                ip_hash=hash_ip(ip_address),
                user_agent=user_agent,
            )
            raise AppError(message="Email is already registered", code="EMAIL_ALREADY_EXISTS", status_code=409)

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
        await self._issue_verification_email(account)
        return await self._create_authenticated_session(account)

    async def login(self, *, email: str, password: str) -> AuthTokenBundle:
        _, email_normalized = normalize_email(email)
        account = await self._account_repository.get_by_email_normalized(email_normalized)
        if account is None or not verify_password(password, account.password_hash):
            raise AppError(message="Invalid credentials", code="INVALID_CREDENTIALS", status_code=401)
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

    async def verify_email(self, *, raw_token: str) -> AuthSessionView:
        verification_token = await self._verification_token_repository.get_by_token_hash(hash_secret(raw_token))
        if verification_token is None:
            raise AppError(message="Verification link is invalid", code="INVALID_VERIFICATION_TOKEN", status_code=400)
        if verification_token.consumed_at is not None:
            raise AppError(message="Verification link is invalid", code="INVALID_VERIFICATION_TOKEN", status_code=400)
        if ensure_utc(verification_token.expires_at) <= utc_now():
            raise AppError(
                message="Verification link has expired",
                code="VERIFICATION_LINK_EXPIRED",
                status_code=410,
            )

        await self._verification_token_repository.consume(token_id=verification_token.id, consumed_at=utc_now())
        account = await self._account_repository.mark_verified(
            account_id=verification_token.account_id,
            verified_at=utc_now(),
        )
        return await self._build_session_view(account)

    async def resend_verification(self, *, account_id: str) -> AuthSessionView:
        account = await self._require_account(account_id)
        if account.email_verified_at is not None:
            return await self._build_session_view(account)

        latest_created_at = await self._verification_token_repository.latest_created_at(account.id)
        now = utc_now()
        if (
            latest_created_at is not None
            and (now - ensure_utc(latest_created_at)).total_seconds() < self._verification_resend_cooldown_seconds
        ):
            raise AppError(
                message="Verification email was sent too recently",
                code="VERIFICATION_EMAIL_COOLDOWN",
                status_code=429,
            )

        sent_last_hour = await self._verification_token_repository.sent_count_since(
            account.id,
            now.replace(minute=0, second=0, microsecond=0),
        )
        if sent_last_hour >= self._verification_resend_hourly_limit:
            raise AppError(
                message="Verification email rate limit exceeded",
                code="VERIFICATION_EMAIL_RATE_LIMITED",
                status_code=429,
            )

        await self._issue_verification_email(account)
        return await self._build_session_view(account)

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
            interests=interests,
        )

    async def _issue_verification_email(self, account: Account) -> None:
        raw_token = issue_token()
        await self._verification_token_repository.create(
            account_id=account.id,
            token_hash=hash_secret(raw_token),
            expires_at=make_expiry(self._verification_token_ttl_seconds),
        )
        await self._email_sender.send_verification_email(
            recipient=account.email,
            display_name=account.display_name,
            verification_link=f"{self._frontend_base_url}/?verify_token={raw_token}",
        )

    async def _require_account(self, account_id: str) -> Account:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        return account
