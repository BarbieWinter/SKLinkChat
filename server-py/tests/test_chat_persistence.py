from __future__ import annotations

import asyncio
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.infrastructure.postgres.models import ChatMessage

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
    assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"

    ws_right.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {"id": right_id, "name": right_name, "short_id": right_short_id, "state": "searching"},
    }
    assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "match",
        "payload": {"id": left_id, "name": left_name, "short_id": left_short_id, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "match",
        "payload": {"id": right_id, "name": right_name, "short_id": right_short_id, "state": "connected"},
    }


async def _list_messages(client) -> list[ChatMessage]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatMessage).order_by(ChatMessage.created_at.asc()))
        return list(result.scalars())


def test_append_message_is_idempotent_with_client_message_id(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    _run(
        durable_chat_repository.create_match(
            left_chat_session_id=left_id,
            right_chat_session_id=right_id,
        )
    )

    first_insert = _run(
        durable_chat_repository.append_message(
            sender_chat_session_id=left_id,
            recipient_chat_session_id=right_id,
            sender_display_name_snapshot="Left",
            body="hello",
            client_message_id="message-1",
        )
    )
    second_insert = _run(
        durable_chat_repository.append_message(
            sender_chat_session_id=left_id,
            recipient_chat_session_id=right_id,
            sender_display_name_snapshot="Left",
            body="hello",
            client_message_id="message-1",
        )
    )

    assert first_insert is True
    assert second_insert is False

    messages = _run(_list_messages(client))
    assert len(messages) == 1
    assert messages[0].message_type == "text"
    assert messages[0].client_message_id == "message-1"
    assert messages[0].sender_display_name_snapshot == "Left"
    assert messages[0].body == "hello"


def test_malformed_websocket_message_does_not_persist_durable_row(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)
    left_short_id = _resolve_short_id(client, session_cookie=left_cookie)
    right_short_id = _resolve_short_id(client, session_cookie=right_cookie)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_left:
        with client.websocket_connect(f"/ws?sessionId={right_id}", cookies={COOKIE_NAME: right_cookie}) as ws_right:
            assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
            assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
            _queue_and_match(
                ws_left,
                ws_right,
                left_id=left_id,
                right_id=right_id,
                left_name="Left",
                right_name="Right",
                left_short_id=left_short_id,
                right_short_id=right_short_id,
            )

            ws_left.send_json({"type": "message", "payload": {"message": 123}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "error",
                "payload": "Malformed payload",
            }

    assert _run(_list_messages(client)) == []
