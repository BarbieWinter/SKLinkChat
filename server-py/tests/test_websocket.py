from __future__ import annotations

import asyncio
import time
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.infrastructure.postgres.models import ChatMatch

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


def _resolve_account_id(client, *, session_cookie: str) -> str:
    account_id, auth_session = _run(client.app.state.container.resolve_auth_session.execute(session_cookie))
    assert account_id is not None
    assert auth_session.authenticated is True
    return account_id


async def _list_matches(client) -> list[ChatMatch]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatMatch).order_by(ChatMatch.started_at.asc()))
        return list(result.scalars())


def _receive_json_ignoring_presence(ws):
    while True:
        message = ws.receive_json()
        if message["type"] != "presence-count":
            return message


def _queue_and_match(ws_left, ws_right, *, left_id: str, right_id: str, left_name: str, right_name: str) -> None:
    ws_left.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {"id": left_id, "name": left_name, "state": "searching"},
    }

    ws_right.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {"id": right_id, "name": right_name, "state": "searching"},
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {"id": right_id, "name": right_name, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "match",
        "payload": {"id": left_id, "name": left_name, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {"id": left_id, "name": left_name, "state": "connected"},
    }
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "match",
        "payload": {"id": right_id, "name": right_name, "state": "connected"},
    }


def test_websocket_requires_owned_verified_chat_session(client):
    left_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")
    left_session_id = _create_chat_session(client, session_cookie=left_cookie)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws?sessionId={left_session_id}",
            cookies={COOKIE_NAME: right_cookie},
        ):
            pass


def test_websocket_queue_match_message_and_typing_flow(client):
    left_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")
    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_left:
        with client.websocket_connect(f"/ws?sessionId={right_id}", cookies={COOKIE_NAME: right_cookie}) as ws_right:
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "user-info",
                "payload": {"id": left_id, "name": "Left", "state": "idle"},
            }
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "user-info",
                "payload": {"id": right_id, "name": "Right", "state": "idle"},
            }

            _queue_and_match(
                ws_left,
                ws_right,
                left_id=left_id,
                right_id=right_id,
                left_name="Left",
                right_name="Right",
            )

            ws_left.send_json({"type": "message", "payload": {"message": "  hello partner  "}})
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "message",
                "payload": {"id": left_id, "name": "Left", "message": "hello partner"},
            }

            ws_right.send_json({"type": "typing", "payload": {"typing": True}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "typing",
                "payload": {"id": right_id, "typing": True},
            }


def test_websocket_reconnect_preserves_existing_match(client):
    left_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")
    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)

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
            )

            ws_right.close()
            time.sleep(0.2)

            with client.websocket_connect(
                f"/ws?sessionId={right_id}",
                cookies={COOKIE_NAME: right_cookie},
            ) as ws_right_reconnected:
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "user-info",
                    "payload": {"id": right_id, "name": "Right", "state": "connected"},
                }
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "match",
                    "payload": {"id": left_id, "name": "Left", "state": "connected"},
                }

                ws_left.send_json({"type": "message", "payload": {"message": "still there?"}})
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "message",
                    "payload": {"id": left_id, "name": "Left", "message": "still there?"},
                }


def test_create_match_closes_overlapping_active_match_for_shared_session(client):
    left_cookie = _register_and_verify(client, email="left@example.com", display_name="Left")
    middle_cookie = _register_and_verify(client, email="middle@example.com", display_name="Middle")
    right_cookie = _register_and_verify(client, email="right@example.com", display_name="Right")

    left_id = _create_chat_session(client, session_cookie=left_cookie)
    middle_id = _create_chat_session(client, session_cookie=middle_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    first_match = _run(
        durable_chat_repository.create_match(
            left_chat_session_id=left_id,
            right_chat_session_id=middle_id,
        )
    )
    second_match = _run(
        durable_chat_repository.create_match(
            left_chat_session_id=middle_id,
            right_chat_session_id=right_id,
        )
    )

    matches = _run(_list_matches(client))
    assert len(matches) == 2
    match_by_id = {match.id: match for match in matches}

    assert match_by_id[first_match.id].ended_at is not None
    assert match_by_id[first_match.id].end_reason == "superseded"
    assert match_by_id[second_match.id].ended_at is None
    assert match_by_id[second_match.id].left_chat_session_id == middle_id
    assert match_by_id[second_match.id].right_chat_session_id == right_id
