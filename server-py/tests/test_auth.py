from __future__ import annotations

import asyncio
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import update

from app.application.auth.security import utc_now
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


def _extract_verification_token(client) -> str:
    fake_sender = client.app.state.container.auth_service._email_sender
    verification_link = fake_sender.sent_messages[-1]["verification_link"]
    query = parse_qs(urlparse(verification_link).query)
    return query["verify_token"][0]


def _assert_short_id(value: str | None) -> None:
    assert value is not None
    assert len(value) == 6
    assert value.isdigit()


def test_register_auto_logs_in_and_requires_email_verification(client):
    response = _register(client)

    assert response.status_code == 201
    payload = response.json()
    assert payload["authenticated"] is True
    assert payload["email_verified"] is False
    assert payload["display_name"] == "Traveler"
    assert payload["interests"] == ["music", "travel"]
    assert payload["is_admin"] is False
    assert payload["chat_access_restricted"] is False
    _assert_short_id(payload["short_id"])
    assert "sklinkchat_session" in response.cookies

    session_response = client.get("/api/auth/session")
    assert session_response.status_code == 200
    assert session_response.json()["email_verified"] is False
    assert session_response.json()["short_id"] == payload["short_id"]
    fake_sender = client.app.state.container.auth_service._email_sender
    verification_messages = [m for m in fake_sender.sent_messages if m.get("type") == "verification"]
    assert len(verification_messages) == 1


def test_verify_email_marks_account_verified(client):
    _register(client)
    verification_token = _extract_verification_token(client)

    response = client.post("/api/auth/verify-email", json={"token": verification_token})

    assert response.status_code == 200
    assert response.json()["email_verified"] is True


def test_verify_email_rejects_reused_token(client):
    _register(client)
    verification_token = _extract_verification_token(client)

    first_response = client.post("/api/auth/verify-email", json={"token": verification_token})
    second_response = client.post("/api/auth/verify-email", json={"token": verification_token})

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["code"] == "INVALID_VERIFICATION_TOKEN"


def test_verify_email_rejects_expired_token(client):
    _register(client)
    verification_token = _extract_verification_token(client)

    async def expire_token() -> None:
        async with client.app.state.container.session_factory() as session:
            await session.execute(
                update(EmailVerificationToken)
                .where(EmailVerificationToken.token_hash.is_not(None))
                .values(expires_at=utc_now() - timedelta(minutes=1))
            )
            await session.commit()

    _run(expire_token())

    response = client.post("/api/auth/verify-email", json={"token": verification_token})

    assert response.status_code == 410
    assert response.json()["code"] == "VERIFICATION_LINK_EXPIRED"


def test_duplicate_email_is_rejected(client):
    first_response = _register(client)
    second_response = _register(client, email="USER@testuser.dev")

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json()["code"] == "EMAIL_ALREADY_EXISTS"


def test_register_assigns_unique_six_digit_short_ids(client):
    first_response = _register(client, email="first@testuser.dev")
    second_response = _register(client, email="second@testuser.dev")

    first_short_id = first_response.json()["short_id"]
    second_short_id = second_response.json()["short_id"]

    _assert_short_id(first_short_id)
    _assert_short_id(second_short_id)
    assert first_short_id != second_short_id


def test_login_logout_and_session_flow(client):
    register_response = _register(client)
    assert register_response.status_code == 201

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    unauthenticated_session = client.get("/api/auth/session")
    assert unauthenticated_session.status_code == 200
    assert unauthenticated_session.json() == {
        "authenticated": False,
        "email_verified": False,
        "display_name": None,
        "short_id": None,
        "interests": [],
        "is_admin": False,
        "chat_access_restricted": False,
    }

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@testuser.dev", "password": "CorrectHorseBatteryStaple!23"},
    )

    assert login_response.status_code == 200
    assert login_response.json()["authenticated"] is True
    assert "sklinkchat_session" in login_response.cookies


def test_resend_verification_requires_authenticated_unverified_account(client):
    register_response = _register(client)
    assert register_response.status_code == 201

    response = client.post("/api/auth/resend-verification")

    assert response.status_code == 429
    assert response.json()["code"] == "VERIFICATION_EMAIL_COOLDOWN"


def test_resend_verification_revokes_previous_link(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    first_verification_token = _extract_verification_token(client)

    client.app.state.container.auth_service._verification_resend_cooldown_seconds = 0
    resend_response = client.post("/api/auth/resend-verification")
    assert resend_response.status_code == 200

    second_verification_token = _extract_verification_token(client)
    assert second_verification_token != first_verification_token
    fake_sender = client.app.state.container.auth_service._email_sender
    verification_messages = [m for m in fake_sender.sent_messages if m.get("type") == "verification"]
    assert len(verification_messages) == 2

    first_verify_response = client.post("/api/auth/verify-email", json={"token": first_verification_token})
    second_verify_response = client.post("/api/auth/verify-email", json={"token": second_verification_token})

    assert first_verify_response.status_code == 400
    assert first_verify_response.json()["code"] == "INVALID_VERIFICATION_TOKEN"
    assert second_verify_response.status_code == 200
    assert second_verify_response.json()["email_verified"] is True


def test_resend_verification_enforces_hourly_limit(client):
    register_response = _register(client)
    assert register_response.status_code == 201

    client.app.state.container.auth_service._verification_resend_cooldown_seconds = 0
    client.app.state.container.auth_service._verification_resend_hourly_limit = 2

    first_resend = client.post("/api/auth/resend-verification")
    second_resend = client.post("/api/auth/resend-verification")

    assert first_resend.status_code == 200
    assert second_resend.status_code == 429
    assert second_resend.json()["code"] == "VERIFICATION_EMAIL_RATE_LIMITED"


def test_resend_verification_returns_idempotent_success_for_verified_account(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    verification_token = _extract_verification_token(client)
    verify_response = client.post("/api/auth/verify-email", json={"token": verification_token})
    assert verify_response.status_code == 200

    response = client.post("/api/auth/resend-verification")

    assert response.status_code == 200
    assert response.json()["email_verified"] is True


def test_auth_session_exposes_admin_capability_and_restriction_flag(client):
    response = _register(client, email="admin@testuser.dev")
    account_id, _ = _run(
        client.app.state.container.resolve_auth_session.execute(response.cookies["sklinkchat_session"])
    )
    assert account_id is not None
    _run(client.app.state.container.account_repository.set_admin_status(account_id=account_id, is_admin=True))

    session_response = client.get(
        "/api/auth/session",
        cookies={"sklinkchat_session": response.cookies["sklinkchat_session"]},
    )

    assert response.status_code == 201
    assert response.json()["is_admin"] is False
    assert response.json()["chat_access_restricted"] is False
    _assert_short_id(response.json()["short_id"])

    assert session_response.status_code == 200
    assert session_response.json()["is_admin"] is True
    assert session_response.json()["chat_access_restricted"] is False
    assert session_response.json()["short_id"] == response.json()["short_id"]


def test_register_rejects_blocked_email_domain(client):
    for blocked_domain in ("example.com", "mailinator.com", "yopmail.com"):
        response = _register(client, email=f"user@{blocked_domain}")
        assert response.status_code == 422
        assert response.json()["code"] == "EMAIL_DOMAIN_BLOCKED"


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
