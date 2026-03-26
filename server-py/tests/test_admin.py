from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.infrastructure.postgres.models import AuditEvent, ChatReport

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

    fake_sender = client.app.state.container.auth_service._email_sender
    code = [m for m in fake_sender.sent_messages if m.get("type") == "verification"][-1]["code"]
    verify_resp = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert verify_resp.status_code == 200

    return verify_resp.cookies[COOKIE_NAME]


def _create_chat_session(client, *, session_cookie: str) -> str:
    response = client.post("/api/session", cookies={COOKIE_NAME: session_cookie})
    assert response.status_code == 200
    return response.json()["session_id"]


def _resolve_account_id(client, *, session_cookie: str) -> str:
    account_id, auth_session = _run(client.app.state.container.resolve_auth_session.execute(session_cookie))
    assert account_id is not None
    assert auth_session.authenticated is True
    return account_id


def _resolve_short_id(client, *, session_cookie: str) -> str:
    response = client.get("/api/auth/session", cookies={COOKIE_NAME: session_cookie})
    assert response.status_code == 200
    short_id = response.json()["short_id"]
    assert isinstance(short_id, str)
    return short_id


def _receive_json_ignoring_presence(ws):
    while True:
        message = ws.receive_json()
        if message["type"] != "presence-count":
            return message


def _queue_and_match(
    ws_left,
    ws_right,
    *,
    left_id: str,
    right_id: str,
    left_name: str,
    right_name: str,
    left_short_id: str,
    right_short_id: str,
) -> None:
    ws_left.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {"id": left_id, "name": left_name, "short_id": left_short_id, "state": "searching"},
    }

    ws_right.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {"id": right_id, "name": right_name, "short_id": right_short_id, "state": "searching"},
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {"id": right_id, "name": right_name, "short_id": right_short_id, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "match",
        "payload": {"id": left_id, "name": left_name, "short_id": left_short_id, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {"id": left_id, "name": left_name, "short_id": left_short_id, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "match",
        "payload": {"id": right_id, "name": right_name, "short_id": right_short_id, "state": "connected"},
    }


async def _list_audit_events(client) -> list[AuditEvent]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(AuditEvent).order_by(AuditEvent.created_at.asc()))
        return list(result.scalars())


async def _list_reports(client) -> list[ChatReport]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatReport).order_by(ChatReport.created_at.asc()))
        return list(result.scalars())


def _seed_report(client) -> tuple[str, str, str, int]:
    reporter_cookie = _register_and_verify(client, email="reporter@test.dev", display_name="Reporter")
    reported_cookie = _register_and_verify(client, email="reported@test.dev", display_name="Reported")
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
    return reporter_cookie, reported_cookie, reported_session_id, response.json()["report_id"]


def test_admin_routes_require_admin_capability(client):
    normal_cookie = _register_and_verify(client, email="user@test.dev", display_name="User")
    client.cookies.clear()

    unauthenticated = client.get("/api/admin/reports")
    forbidden = client.get("/api/admin/reports", cookies={COOKIE_NAME: normal_cookie})

    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "UNAUTHENTICATED"
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "ADMIN_FORBIDDEN"


def test_admin_can_review_report_and_browse_audit_log(client):
    admin_cookie = _register_and_verify(client, email="admin@test.dev", display_name="Admin")
    admin_account_id = _resolve_account_id(client, session_cookie=admin_cookie)
    _run(client.app.state.container.account_repository.set_admin_status(account_id=admin_account_id, is_admin=True))
    reporter_cookie, reported_cookie, _reported_session_id, report_id = _seed_report(client)
    reporter_short_id = _resolve_short_id(client, session_cookie=reporter_cookie)
    reported_short_id = _resolve_short_id(client, session_cookie=reported_cookie)

    review_response = client.post(
        f"/api/admin/reports/{report_id}/review",
        cookies={COOKIE_NAME: admin_cookie},
        json={"status": "actioned", "review_note": "Confirmed harassment"},
    )

    assert review_response.status_code == 200
    assert review_response.json()["status"] == "actioned"
    assert review_response.json()["review_note"] == "Confirmed harassment"
    assert review_response.json()["reviewer_display_name"] == "Admin"
    assert review_response.json()["reporter_short_id"] == reporter_short_id
    assert review_response.json()["reported_short_id"] == reported_short_id

    reports = _run(_list_reports(client))
    assert reports[0].status == "actioned"
    assert reports[0].reviewed_by_account_id is not None
    assert reports[0].review_note == "Confirmed harassment"

    audit_response = client.get(
        "/api/admin/audit-events",
        cookies={COOKIE_NAME: admin_cookie},
        params={"event_type": "admin.report.reviewed"},
    )
    assert audit_response.status_code == 200
    assert audit_response.json()["items"][0]["event_type"] == "admin.report.reviewed"
    assert audit_response.json()["items"][0]["account_short_id"] == reported_short_id


def test_admin_can_list_restricted_accounts_with_source_report(client):
    admin_cookie = _register_and_verify(client, email="admin@test.dev", display_name="Admin")
    admin_account_id = _resolve_account_id(client, session_cookie=admin_cookie)
    _run(client.app.state.container.account_repository.set_admin_status(account_id=admin_account_id, is_admin=True))
    _reporter_cookie, reported_cookie, _reported_session_id, report_id = _seed_report(client)
    reported_account_id = _resolve_account_id(client, session_cookie=reported_cookie)
    reported_short_id = _resolve_short_id(client, session_cookie=reported_cookie)

    restrict_response = client.post(
        f"/api/admin/accounts/{reported_account_id}/restrict",
        cookies={COOKIE_NAME: admin_cookie},
        json={"reason": "Confirmed abuse", "source_report_id": report_id},
    )
    assert restrict_response.status_code == 200

    restricted_response = client.get("/api/admin/restricted-accounts", cookies={COOKIE_NAME: admin_cookie})
    assert restricted_response.status_code == 200
    item = restricted_response.json()["items"][0]
    assert item["display_name"] == "Reported"
    assert item["short_id"] == reported_short_id
    assert item["chat_access_restricted"] is True
    assert item["source_report_id"] == report_id
    assert item["source_report_reason"] == "harassment"


def test_admin_restrict_disconnects_active_chat_and_restore_reopens_access(client):
    admin_cookie = _register_and_verify(client, email="admin@test.dev", display_name="Admin")
    admin_account_id = _resolve_account_id(client, session_cookie=admin_cookie)
    _run(client.app.state.container.account_repository.set_admin_status(account_id=admin_account_id, is_admin=True))

    reporter_cookie = _register_and_verify(client, email="reporter@test.dev", display_name="Reporter")
    target_cookie = _register_and_verify(client, email="target@test.dev", display_name="Target")
    partner_cookie = _register_and_verify(client, email="partner@test.dev", display_name="Partner")

    reporter_session_id = _create_chat_session(client, session_cookie=reporter_cookie)
    target_session_id = _create_chat_session(client, session_cookie=target_cookie)
    partner_session_id = _create_chat_session(client, session_cookie=partner_cookie)
    target_account_id = _resolve_account_id(client, session_cookie=target_cookie)
    target_short_id = _resolve_short_id(client, session_cookie=target_cookie)
    partner_short_id = _resolve_short_id(client, session_cookie=partner_cookie)

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    _run(
        durable_chat_repository.create_match(
            left_chat_session_id=reporter_session_id,
            right_chat_session_id=target_session_id,
        )
    )
    report_response = client.post(
        "/api/chat/reports",
        cookies={COOKIE_NAME: reporter_cookie},
        json={
            "session_id": reporter_session_id,
            "reported_session_id": target_session_id,
            "reason": "harassment",
            "details": "Repeated insults",
        },
    )
    assert report_response.status_code == 200
    report_id = report_response.json()["report_id"]

    with client.websocket_connect(
        f"/ws?sessionId={target_session_id}",
        cookies={COOKIE_NAME: target_cookie},
    ) as ws_target:
        with client.websocket_connect(
            f"/ws?sessionId={partner_session_id}",
            cookies={COOKIE_NAME: partner_cookie},
        ) as ws_partner:
            assert _receive_json_ignoring_presence(ws_target) == {
                "type": "user-info",
                "payload": {"id": target_session_id, "name": "Target", "short_id": target_short_id, "state": "idle"},
            }
            assert _receive_json_ignoring_presence(ws_partner) == {
                "type": "user-info",
                "payload": {
                    "id": partner_session_id,
                    "name": "Partner",
                    "short_id": partner_short_id,
                    "state": "idle",
                },
            }
            _queue_and_match(
                ws_target,
                ws_partner,
                left_id=target_session_id,
                right_id=partner_session_id,
                left_name="Target",
                right_name="Partner",
                left_short_id=target_short_id,
                right_short_id=partner_short_id,
            )

            restrict_response = client.post(
                f"/api/admin/accounts/{target_account_id}/restrict",
                cookies={COOKIE_NAME: admin_cookie},
                json={"reason": "Repeated abusive reports", "source_report_id": report_id},
            )
            assert restrict_response.status_code == 200
            assert restrict_response.json()["chat_access_restricted"] is True

            with pytest.raises(WebSocketDisconnect):
                ws_target.receive_json()

            assert _receive_json_ignoring_presence(ws_partner) == {
                "type": "disconnect",
                "payload": None,
            }

    denied_session = client.post("/api/session", cookies={COOKIE_NAME: target_cookie})
    session_payload = client.get("/api/auth/session", cookies={COOKIE_NAME: target_cookie})

    assert denied_session.status_code == 403
    assert denied_session.json()["code"] == "CHAT_ACCESS_RESTRICTED"
    assert session_payload.status_code == 200
    assert session_payload.json()["chat_access_restricted"] is True

    restore_response = client.post(
        f"/api/admin/accounts/{target_account_id}/restore",
        cookies={COOKIE_NAME: admin_cookie},
        json={"reason": "Appeal accepted"},
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["chat_access_restricted"] is False

    restored_session = client.post("/api/session", cookies={COOKIE_NAME: target_cookie})
    assert restored_session.status_code == 200

    audit_events = _run(_list_audit_events(client))
    event_types = [event.event_type for event in audit_events]
    assert "admin.account.chat_restricted" in event_types
    assert "chat.session.revoked" in event_types
    assert "admin.account.chat_restored" in event_types
