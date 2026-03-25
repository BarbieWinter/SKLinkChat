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
        "email": "user@example.com",
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


def test_register_auto_logs_in_and_requires_email_verification(client):
    response = _register(client)

    assert response.status_code == 201
    assert response.json() == {
        "authenticated": True,
        "email_verified": False,
        "display_name": "Traveler",
        "interests": ["music", "travel"],
    }
    assert "sklinkchat_session" in response.cookies

    session_response = client.get("/api/auth/session")
    assert session_response.status_code == 200
    assert session_response.json()["email_verified"] is False


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
    second_response = _register(client, email="USER@example.com")

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json()["code"] == "EMAIL_ALREADY_EXISTS"


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
        "interests": [],
    }

    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "CorrectHorseBatteryStaple!23"},
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
