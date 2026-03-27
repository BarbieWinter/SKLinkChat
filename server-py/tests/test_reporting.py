from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.infrastructure.postgres.models import ChatReport

COOKIE_NAME = "sklinkchat_session"


def _run(coro):
    return asyncio.run(coro)


def _captcha_payload() -> dict[str, str]:
    return {
        "lot_number": "lot-register",
        "captcha_output": "captcha-output",
        "pass_token": "pass-token",
        "gen_time": "2026-03-27T12:00:00Z",
    }


def _register_and_verify(client, *, email: str, display_name: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "CorrectHorseBatteryStaple!23",
            "display_name": display_name,
            "interests": ["music"],
            "captcha": _captcha_payload(),
        },
    )
    assert response.status_code == 201

    fake_sender = client.app.state.container.auth_service._email_sender
    code = [m for m in fake_sender.sent_messages if m.get("type") == "verification"][-1]["code"]
    verify_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert verify_resp.status_code == 200

    return verify_resp.cookies[COOKIE_NAME]


def _create_chat_session(client, *, session_cookie: str) -> str:
    response = client.post("/api/session", cookies={COOKIE_NAME: session_cookie})
    assert response.status_code == 200
    return response.json()["session_id"]


async def _list_reports(client) -> list[ChatReport]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatReport).order_by(ChatReport.created_at.asc()))
        return list(result.scalars())


def test_chat_report_accepts_active_match_participant(client):
    reporter_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    reported_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
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
    reporter_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    partner_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    outsider_cookie = _register_and_verify(client, email="other@test.dev", display_name="Other")
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


def test_chat_report_allows_admin_report_with_stale_client_session_id(client):
    admin_cookie = _register_and_verify(client, email="admin@test.dev", display_name="Admin")
    partner_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    outsider_cookie = _register_and_verify(client, email="other@test.dev", display_name="Other")
    admin_session_id = _create_chat_session(client, session_cookie=admin_cookie)
    partner_session_id = _create_chat_session(client, session_cookie=partner_cookie)
    stale_session_id = _create_chat_session(client, session_cookie=outsider_cookie)

    account_id, _ = _run(client.app.state.container.resolve_auth_session.execute(admin_cookie))
    assert account_id is not None
    _run(client.app.state.container.account_repository.set_admin_status(account_id=account_id, is_admin=True))

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    _run(
        durable_chat_repository.create_match(
            left_chat_session_id=admin_session_id,
            right_chat_session_id=partner_session_id,
        )
    )

    response = client.post(
        "/api/chat/reports",
        cookies={COOKIE_NAME: admin_cookie},
        json={
            "session_id": stale_session_id,
            "reported_session_id": partner_session_id,
            "reason": "spam",
        },
    )

    assert response.status_code == 200
    reports = _run(_list_reports(client))
    assert len(reports) == 1
    assert reports[0].reported_chat_session_id == partner_session_id
