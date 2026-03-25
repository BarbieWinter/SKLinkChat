from __future__ import annotations

import asyncio
import time
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from starlette.websockets import WebSocketDisconnect

from app.shared.protocol import UserState

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


def _create_duplicate_chat_session(client, *, session_cookie: str) -> str:
    duplicate_session_id = str(uuid4())
    account_id = _resolve_account_id(client, session_cookie=session_cookie)
    _run(
        client.app.state.container.chat_access_service._durable_chat_repository.touch_chat_session(
            account_id=account_id,
            chat_session_id=duplicate_session_id,
        )
    )
    return duplicate_session_id


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


def test_try_match_skips_duplicate_sessions_from_same_account(client):
    primary_cookie = _register_and_verify(client, email="primary@example.com", display_name="Primary")
    other_cookie = _register_and_verify(client, email="other@example.com", display_name="Other")

    primary_id = _create_chat_session(client, session_cookie=primary_cookie)
    duplicate_id = _create_duplicate_chat_session(client, session_cookie=primary_cookie)
    other_id = _create_chat_session(client, session_cookie=other_cookie)

    runtime = client.app.state.container.chat_runtime_service
    _run(runtime.register_connection(primary_id, object()))
    _run(runtime.register_connection(duplicate_id, object()))
    _run(runtime.register_connection(other_id, object()))

    primary_session = _run(runtime.enter_queue(primary_id))
    duplicate_session = _run(runtime.enter_queue(duplicate_id))
    assert primary_session.state is UserState.SEARCHING
    assert duplicate_session.state is UserState.SEARCHING
    assert _run(runtime.try_match()) is None

    _run(runtime.enter_queue(other_id))
    match = _run(runtime.try_match())

    assert match is not None
    matched_ids = {match.left.session_id, match.right.session_id}
    assert other_id in matched_ids
    assert len(matched_ids & {primary_id, duplicate_id}) == 1

    durable_chat_repository = client.app.state.container.chat_access_service._durable_chat_repository
    left_account_id = _run(durable_chat_repository.get_account_id_for_chat_session(match.left.session_id))
    right_account_id = _run(durable_chat_repository.get_account_id_for_chat_session(match.right.session_id))
    assert left_account_id is not None
    assert right_account_id is not None
    assert left_account_id != right_account_id
