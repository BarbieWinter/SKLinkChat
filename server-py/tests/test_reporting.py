from __future__ import annotations

import asyncio
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.infrastructure.postgres.models import ChatReport

COOKIE_NAME = "sklinkchat_session"


def _run(coro):
    return asyncio.run(coro)


def _register_and_verify(client, *, email: str, display_name: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "CorrectHorseBatteryStaple!23",
            "display_name": display_name,
            "interests": ["music"],
            "turnstile_token": "test-token",
        },
    )
    assert response.status_code == 201

    verification_link = client.app.state.container.auth_service._email_sender.sent_messages[-1]["verification_link"]
    verification_token = parse_qs(urlparse(verification_link).query)["verify_token"][0]
    verify_response = client.post("/api/auth/verify-email", json={"token": verification_token})
    assert verify_response.status_code == 200

    return response.cookies[COOKIE_NAME]


def _create_chat_session(client, *, session_cookie: str) -> str:
    response = client.post("/api/session", cookies={COOKIE_NAME: session_cookie})
    assert response.status_code == 200
    return response.json()["session_id"]


async def _list_reports(client) -> list[ChatReport]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatReport).order_by(ChatReport.created_at.asc()))
        return list(result.scalars())


def test_chat_report_accepts_active_match_participant(client):
    reporter_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    reported_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")
    reporter_session_id = _create_chat_session(client, session_cookie=reporter_cookie)
    reported_session_id = _create_chat_session(client, session_cookie=reported_cookie)

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    _run(
        durable_chat_repository.create_match(
            left_chat_session_id=reporter_session_id,
            right_chat_session_id=reported_session_id,
        )
    )

    response = client.post(
        "/api/chat/reports",
        cookies={COOKIE_NAME: reporter_cookie},
        json={
            "session_id": reporter_session_id,
            "reported_session_id": reported_session_id,
            "reason": "harassment",
            "details": "Repeated insults",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

    reports = _run(_list_reports(client))
    assert len(reports) == 1
    assert reports[0].reason == "harassment"
    assert reports[0].reported_chat_session_id == reported_session_id


def test_chat_report_rejects_non_participant_and_other_without_details(client):
    reporter_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    partner_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")
    outsider_cookie = _register_and_verify(client, email="other@example.com", display_name="Other")
    reporter_session_id = _create_chat_session(client, session_cookie=reporter_cookie)
    partner_session_id = _create_chat_session(client, session_cookie=partner_cookie)
    outsider_session_id = _create_chat_session(client, session_cookie=outsider_cookie)

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    _run(
        durable_chat_repository.create_match(
            left_chat_session_id=reporter_session_id,
            right_chat_session_id=partner_session_id,
        )
    )

    missing_details_response = client.post(
        "/api/chat/reports",
        cookies={COOKIE_NAME: reporter_cookie},
        json={
            "session_id": reporter_session_id,
            "reported_session_id": partner_session_id,
            "reason": "other",
            "details": "",
        },
    )
    forbidden_response = client.post(
        "/api/chat/reports",
        cookies={COOKIE_NAME: outsider_cookie},
        json={
            "session_id": outsider_session_id,
            "reported_session_id": partner_session_id,
            "reason": "spam",
        },
    )

    assert missing_details_response.status_code == 422
    assert missing_details_response.json()["code"] == "REPORT_DETAILS_REQUIRED"
    assert forbidden_response.status_code == 403
    assert forbidden_response.json()["code"] == "CHAT_REPORT_FORBIDDEN"
    assert _run(_list_reports(client)) == []
