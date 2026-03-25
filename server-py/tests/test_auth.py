from __future__ import annotations

from urllib.parse import parse_qs, urlparse


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
