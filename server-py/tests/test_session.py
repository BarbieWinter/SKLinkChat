from __future__ import annotations

import asyncio
from urllib.parse import parse_qs, urlparse


def _run(coro):
    return asyncio.run(coro)


def _register(client):
    return client.post(
        "/api/auth/register",
        json={
            "email": "user@example.com",
            "password": "CorrectHorseBatteryStaple!23",
            "display_name": "Traveler",
            "interests": ["music", "travel"],
            "turnstile_token": "test-token",
        },
    )


def _verify(client) -> None:
    fake_sender = client.app.state.container.auth_service._email_sender
    verification_link = fake_sender.sent_messages[-1]["verification_link"]
    verification_token = parse_qs(urlparse(verification_link).query)["verify_token"][0]
    response = client.post("/api/auth/verify-email", json={"token": verification_token})
    assert response.status_code == 200


def test_create_session_requires_authenticated_user(client):
    response = client.post("/api/session")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_create_session_requires_verified_email(client):
    register_response = _register(client)
    assert register_response.status_code == 201

    session_response = client.post("/api/session")
    assert session_response.status_code == 403
    assert session_response.json()["code"] == "EMAIL_NOT_VERIFIED"


def test_create_session_returns_chat_session_for_verified_account(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    _verify(client)

    session_response = client.post("/api/session")

    assert session_response.status_code == 200
    assert set(session_response.json().keys()) == {"session_id"}
    assert isinstance(session_response.json()["session_id"], str)
    assert session_response.json()["session_id"].strip() != ""


def test_create_session_reuses_existing_chat_session_for_same_account(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    _verify(client)

    first_response = client.post("/api/session")
    second_response = client.post("/api/session")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["session_id"] == second_response.json()["session_id"]

    account_id, auth_session = _run(
        client.app.state.container.resolve_auth_session.execute(register_response.cookies["sklinkchat_session"])
    )
    assert account_id is not None
    assert auth_session.authenticated is True

    stored_session_id = _run(
        client.app.state.container.chat_access_service._durable_chat_repository.get_latest_chat_session_id_for_account(
            account_id
        )
    )
    assert stored_session_id == first_response.json()["session_id"]
