from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.application.auth.security import utc_now
from app.infrastructure.postgres.models import ChatSessionRecord


def _run(coro):
    return asyncio.run(coro)


def _captcha_payload() -> dict[str, str]:
    return {
        "lot_number": "lot-register",
        "captcha_output": "captcha-output",
        "pass_token": "pass-token",
        "gen_time": "2026-03-27T12:00:00Z",
    }


def _register(client):
    return client.post(
        "/api/auth/register",
        json={
            "email": "user@test.dev",
            "password": "CorrectHorseBatteryStaple!23",
            "display_name": "Traveler",
            "interests": ["music", "travel"],
            "captcha": _captcha_payload(),
        },
    )


def _verify(client, email="user@test.dev") -> str:
    fake_sender = client.app.state.container.auth_service._email_sender
    code = [m for m in fake_sender.sent_messages if m.get("type") == "verification"][-1]["code"]
    verify_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert verify_resp.status_code == 200
    return verify_resp.cookies["sklinkchat_session"]


async def _list_active_chat_session_ids(client, *, account_id: str) -> list[str]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(
            select(ChatSessionRecord.id)
            .where(
                ChatSessionRecord.account_id == account_id,
                ChatSessionRecord.status == "active",
            )
            .order_by(ChatSessionRecord.created_at.asc())
        )
        return list(result.scalars())


def test_create_session_requires_authenticated_user(client):
    response = client.post("/api/session")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_create_session_requires_verified_email(client):
    register_response = _register(client)
    assert register_response.status_code == 201

    session_response = client.post("/api/session")
    assert session_response.status_code == 401
    assert session_response.json()["code"] == "UNAUTHENTICATED"


def test_create_session_rejects_restricted_account(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    session_cookie = _verify(client)

    account_id, auth_session = _run(
        client.app.state.container.resolve_auth_session.execute(session_cookie)
    )
    assert account_id is not None
    assert auth_session.authenticated is True

    _run(
        client.app.state.container.account_repository.set_chat_access_restriction(
            account_id=account_id,
            restricted_at=utc_now(),
            restriction_reason="Repeated abuse",
            restriction_report_id=1,
        )
    )

    session_response = client.post("/api/session")

    assert session_response.status_code == 403
    assert session_response.json()["code"] == "CHAT_ACCESS_RESTRICTED"


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
    session_cookie = _verify(client)

    first_response = client.post("/api/session")
    second_response = client.post("/api/session")

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["session_id"] == second_response.json()["session_id"]

    account_id, auth_session = _run(
        client.app.state.container.resolve_auth_session.execute(session_cookie)
    )
    assert account_id is not None
    assert auth_session.authenticated is True

    active_session_ids = _run(_list_active_chat_session_ids(client, account_id=account_id))
    assert active_session_ids == [first_response.json()["session_id"]]


def test_concurrent_create_session_collapses_to_single_active_row(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    session_cookie = _verify(client)

    account_id, auth_session = _run(
        client.app.state.container.resolve_auth_session.execute(session_cookie)
    )
    assert account_id is not None
    assert auth_session.authenticated is True

    async def create_many() -> list[str]:
        return await asyncio.gather(
            client.app.state.container.chat_access_service.create_chat_session(account_id),
            client.app.state.container.chat_access_service.create_chat_session(account_id),
            client.app.state.container.chat_access_service.create_chat_session(account_id),
            client.app.state.container.chat_access_service.create_chat_session(account_id),
        )

    session_ids = _run(create_many())
    assert len(set(session_ids)) == 1
    assert _run(_list_active_chat_session_ids(client, account_id=account_id)) == [session_ids[0]]


def test_database_constraint_rejects_second_active_chat_session_row(client):
    register_response = _register(client)
    assert register_response.status_code == 201
    session_cookie = _verify(client)

    created_session_id = client.post("/api/session").json()["session_id"]
    account_id, auth_session = _run(
        client.app.state.container.resolve_auth_session.execute(session_cookie)
    )
    assert account_id is not None
    assert auth_session.authenticated is True

    async def insert_duplicate_row() -> None:
        async with client.app.state.container.session_factory() as session:
            session.add(
                ChatSessionRecord(
                    id=str(uuid4()),
                    account_id=account_id,
                    display_name_snapshot="Traveler",
                    status="active",
                )
            )
            await session.commit()

    with pytest.raises(IntegrityError):
        _run(insert_duplicate_row())

    assert _run(_list_active_chat_session_ids(client, account_id=account_id)) == [created_session_id]
