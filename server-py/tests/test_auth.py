from __future__ import annotations

import asyncio
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select, update

from app.application.auth.security import hash_secret, utc_now
from app.infrastructure.postgres.models import EmailVerificationToken


def _run(coro):
    return asyncio.run(coro)


def _register(client, **overrides):
    payload = {
        "email": "user@testuser.dev",
        "password": "CorrectHorseBatteryStaple!23",
        "display_name": "Traveler",
        "interests": ["music", "travel"],
        "turnstile_token": "test-token",
    }
    payload.update(overrides)
    return client.post("/api/auth/register", json=payload)


def _extract_verification_code(client, recipient: str = "user@testuser.dev") -> str:
    fake_sender = client.app.state.container.auth_service._email_sender
    verification_messages = [
        m
        for m in fake_sender.sent_messages
        if m.get("type") == "verification" and m.get("recipient") == recipient
    ]
    return verification_messages[-1]["code"]


def _verify_code(client, email: str = "user@testuser.dev", code: str | None = None):
    if code is None:
        code = _extract_verification_code(client, recipient=email)
    return client.post("/api/auth/verify-email", json={"email": email, "code": code})


def _latest_verification_token(client, email: str = "user@testuser.dev") -> EmailVerificationToken:
    async def fetch() -> EmailVerificationToken:
        account = await client.app.state.container.account_repository.get_by_email_normalized(email.lower())
        assert account is not None
        async with client.app.state.container.session_factory() as session:
            result = await session.execute(
                select(EmailVerificationToken)
                .where(EmailVerificationToken.account_id == account.id)
                .order_by(EmailVerificationToken.created_at.desc())
                .limit(1)
            )
            token = result.scalar_one_or_none()
            assert token is not None
            return token

    return _run(fetch())


def _assert_short_id(value: str | None) -> None:
    assert value is not None
    assert len(value) == 6
    assert value.isdigit()


# --- Registration ---


def test_register_returns_verification_required(client):
    response = _register(client)

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "verification_required"
    assert "masked_email" in payload
    assert "@testuser.dev" in payload["masked_email"]
    assert "sklinkchat_session" not in response.cookies

    session_response = client.get("/api/auth/session")
    assert session_response.json()["authenticated"] is False

    fake_sender = client.app.state.container.auth_service._email_sender
    verification_messages = [m for m in fake_sender.sent_messages if m.get("type") == "verification"]
    assert len(verification_messages) == 1
    assert len(verification_messages[0]["code"]) == 6
    assert verification_messages[0]["code"].isdigit()


def test_register_unverified_email_resends_code(client):
    first = _register(client)
    assert first.status_code == 201

    second = _register(client, password="DifferentPassword!99")
    assert second.status_code == 201
    assert second.json()["status"] == "verification_required"

    fake_sender = client.app.state.container.auth_service._email_sender
    verification_messages = [m for m in fake_sender.sent_messages if m.get("type") == "verification"]
    assert len(verification_messages) == 2


def test_register_verified_email_rejects(client):
    _register(client)
    _verify_code(client)

    response = _register(client, email="USER@testuser.dev")
    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_EXISTS"


def test_register_rejects_blocked_email_domain(client):
    for blocked_domain in ("example.com", "mailinator.com", "yopmail.com"):
        response = _register(client, email=f"user@{blocked_domain}")
        assert response.status_code == 422
        assert response.json()["code"] == "EMAIL_DOMAIN_BLOCKED"


# --- Verification Code ---


def test_verify_code_creates_session(client):
    _register(client)
    response = _verify_code(client)

    assert response.status_code == 200
    payload = response.json()
    assert payload["authenticated"] is True
    assert payload["email_verified"] is True
    assert payload["display_name"] == "Traveler"
    assert payload["interests"] == ["music", "travel"]
    _assert_short_id(payload["short_id"])
    assert "sklinkchat_session" in response.cookies


def test_verification_token_hash_uses_random_token_id(client):
    _register(client)
    code = _extract_verification_code(client)
    token = _latest_verification_token(client)

    assert token.token_hash == hash_secret(f"{token.id}:{code}")
    assert token.token_hash != hash_secret(f"{token.account_id}:{code}")


def test_verify_code_rejects_wrong_code(client):
    _register(client)

    response = _verify_code(client, code="000000")

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_VERIFICATION_CODE"


def test_verify_code_rejects_expired(client):
    _register(client)
    code = _extract_verification_code(client)

    async def expire_tokens() -> None:
        async with client.app.state.container.session_factory() as session:
            await session.execute(
                update(EmailVerificationToken)
                .where(EmailVerificationToken.token_hash.is_not(None))
                .values(expires_at=utc_now() - timedelta(minutes=1))
            )
            await session.commit()

    _run(expire_tokens())

    response = _verify_code(client, code=code)
    assert response.status_code == 400
    assert response.json()["code"] == "NO_PENDING_VERIFICATION"


def test_verify_code_enforces_max_attempts(client):
    _register(client)

    for _ in range(4):
        resp = _verify_code(client, code="000000")
        assert resp.status_code == 400

    fifth = _verify_code(client, code="000000")
    assert fifth.status_code == 429
    assert fifth.json()["code"] == "VERIFICATION_MAX_ATTEMPTS"

    token = _latest_verification_token(client)
    assert token.attempts == 5
    assert token.revoked_at is not None

    follow_up = _verify_code(client, code="000000")
    assert follow_up.status_code == 400
    assert follow_up.json()["code"] == "NO_PENDING_VERIFICATION"


def test_verify_code_rejects_reused(client):
    _register(client)
    code = _extract_verification_code(client)

    first = _verify_code(client, code=code)
    second = _verify_code(client, code=code)

    assert first.status_code == 200
    assert second.status_code == 400


def test_verify_code_rejects_cross_account_token(client, monkeypatch):
    _register(client, email="owner@testuser.dev")
    _register(client, email="other@testuser.dev")

    other_token = _latest_verification_token(client, email="other@testuser.dev")
    other_code = _extract_verification_code(client, recipient="other@testuser.dev")

    async def get_mismatched_token(account_id: str, now):
        return other_token

    monkeypatch.setattr(
        client.app.state.container.auth_service._verification_token_repository,
        "get_active_for_account",
        get_mismatched_token,
    )

    response = _verify_code(client, email="owner@testuser.dev", code=other_code)
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_VERIFICATION_CODE"


# --- Resend Verification ---


def test_resend_code_enforces_cooldown(client):
    _register(client)

    response = client.post("/api/auth/resend-verification", json={"email": "user@testuser.dev"})
    assert response.status_code == 429
    assert response.json()["code"] == "VERIFICATION_CODE_COOLDOWN"


def test_resend_code_revokes_previous(client):
    _register(client)
    first_code = _extract_verification_code(client)

    client.app.state.container.auth_service._verification_resend_cooldown_seconds = 0
    client.post("/api/auth/resend-verification", json={"email": "user@testuser.dev"})

    second_code = _extract_verification_code(client)
    assert first_code != second_code

    first_verify = _verify_code(client, code=first_code)
    assert first_verify.status_code == 400

    second_verify = _verify_code(client, code=second_code)
    assert second_verify.status_code == 200
    assert second_verify.json()["email_verified"] is True


def test_resend_code_enforces_hourly_limit(client):
    _register(client)

    client.app.state.container.auth_service._verification_resend_cooldown_seconds = 0
    client.app.state.container.auth_service._verification_resend_hourly_limit = 2

    first = client.post("/api/auth/resend-verification", json={"email": "user@testuser.dev"})
    second = client.post("/api/auth/resend-verification", json={"email": "user@testuser.dev"})

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["code"] == "VERIFICATION_CODE_RATE_LIMITED"


def test_resend_code_silent_for_unknown_email(client):
    response = client.post("/api/auth/resend-verification", json={"email": "nobody@testuser.dev"})
    assert response.status_code == 200


def test_resend_code_silent_for_verified_account(client):
    _register(client)
    _verify_code(client)

    response = client.post("/api/auth/resend-verification", json={"email": "user@testuser.dev"})
    assert response.status_code == 200


# --- Login ---


def test_login_verified_creates_session(client):
    _register(client)
    _verify_code(client)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "CorrectHorseBatteryStaple!23"},
    )

    assert login_response.status_code == 200
    assert login_response.json()["authenticated"] is True
    assert "sklinkchat_session" in login_response.cookies


def test_login_unverified_sends_code(client):
    _register(client)
    client.app.state.container.auth_service._verification_resend_cooldown_seconds = 0

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "CorrectHorseBatteryStaple!23"},
    )

    assert login_response.status_code == 200
    assert login_response.json()["status"] == "verification_required"
    assert "sklinkchat_session" not in login_response.cookies


def test_login_unverified_respects_resend_cooldown(client):
    _register(client)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "CorrectHorseBatteryStaple!23"},
    )

    assert login_response.status_code == 429
    assert login_response.json()["code"] == "VERIFICATION_CODE_COOLDOWN"


def test_login_logout_and_session_flow(client):
    _register(client)
    _verify_code(client)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "CorrectHorseBatteryStaple!23"},
    )
    assert login_response.status_code == 200
    assert "sklinkchat_session" in login_response.cookies

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    session_response = client.get("/api/auth/session")
    assert session_response.json()["authenticated"] is False


def test_auth_session_exposes_admin_capability(client):
    _register(client, email="admin@testuser.dev")
    verify_resp = _verify_code(client, email="admin@testuser.dev")
    session_cookie = verify_resp.cookies["sklinkchat_session"]

    account_id, _ = _run(
        client.app.state.container.resolve_auth_session.execute(session_cookie)
    )
    assert account_id is not None
    _run(client.app.state.container.account_repository.set_admin_status(account_id=account_id, is_admin=True))

    session_response = client.get("/api/auth/session", cookies={"sklinkchat_session": session_cookie})
    assert session_response.status_code == 200
    assert session_response.json()["is_admin"] is True


# --- Password Reset ---


def _extract_reset_link(client) -> str:
    fake_sender = client.app.state.container.auth_service._email_sender
    reset_messages = [m for m in fake_sender.sent_messages if m.get("type") == "password_reset"]
    return reset_messages[-1]["reset_link"]


def _extract_reset_token(client) -> str:
    reset_link = _extract_reset_link(client)
    query = parse_qs(urlparse(reset_link).query)
    return query["reset_token"][0]


def test_request_password_reset_sends_email(client):
    _register(client)
    response = client.post("/api/auth/request-password-reset", json={"email": "user@testuser.dev"})
    assert response.status_code == 200
    reset_link = _extract_reset_link(client)
    assert "reset_token=" in reset_link


def test_request_password_reset_silent_for_unknown_email(client):
    response = client.post("/api/auth/request-password-reset", json={"email": "nobody@testuser.dev"})
    assert response.status_code == 200


def test_reset_password_flow(client):
    _register(client)
    client.post("/api/auth/request-password-reset", json={"email": "user@testuser.dev"})
    reset_token = _extract_reset_token(client)

    response = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": "NewSecurePassword!99"},
    )
    assert response.status_code == 200

    _verify_code(client)

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "NewSecurePassword!99"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["authenticated"] is True


def test_reset_password_rejects_reused_token(client):
    _register(client)
    client.post("/api/auth/request-password-reset", json={"email": "user@testuser.dev"})
    reset_token = _extract_reset_token(client)

    first = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewSecurePassword!99"})
    second = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "AnotherPassword!88"})
    assert first.status_code == 200
    assert second.status_code == 400
    assert second.json()["code"] == "INVALID_RESET_TOKEN"


def test_reset_password_rejects_short_password(client):
    _register(client)
    client.post("/api/auth/request-password-reset", json={"email": "user@testuser.dev"})
    reset_token = _extract_reset_token(client)

    response = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "short"})
    assert response.status_code == 422
