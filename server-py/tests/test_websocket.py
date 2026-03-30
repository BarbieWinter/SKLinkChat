from __future__ import annotations

import asyncio
import time

import pytest
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.application.auth.security import utc_now
from app.infrastructure.postgres.models import ChatMatch

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


async def _list_matches(client) -> list[ChatMatch]:
    async with client.app.state.container.session_factory() as session:
        result = await session.execute(select(ChatMatch).order_by(ChatMatch.started_at.asc()))
        return list(result.scalars())


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


def test_websocket_requires_owned_verified_chat_session(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    left_session_id = _create_chat_session(client, session_cookie=left_cookie)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws?sessionId={left_session_id}",
            cookies={COOKIE_NAME: right_cookie},
        ):
            pass


def test_websocket_rejects_restricted_account(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    left_session_id = _create_chat_session(client, session_cookie=left_cookie)
    account_id = _resolve_account_id(client, session_cookie=left_cookie)

    _run(
        client.app.state.container.account_repository.set_chat_access_restriction(
            account_id=account_id,
            restricted_at=utc_now(),
            restriction_reason="Repeated abuse",
            restriction_report_id=1,
        )
    )

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws?sessionId={left_session_id}",
            cookies={COOKIE_NAME: left_cookie},
        ):
            pass


def test_websocket_queue_match_message_and_typing_flow(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)
    left_short_id = _resolve_short_id(client, session_cookie=left_cookie)
    right_short_id = _resolve_short_id(client, session_cookie=right_cookie)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_left:
        with client.websocket_connect(f"/ws?sessionId={right_id}", cookies={COOKIE_NAME: right_cookie}) as ws_right:
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "user-info",
                "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "idle"},
            }
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "user-info",
                "payload": {"id": right_id, "name": "Right", "short_id": right_short_id, "state": "idle"},
            }

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


def test_websocket_rejects_oversized_message_payload(client):
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

            ws_left.send_json({"type": "message", "payload": {"message": "x" * 4001}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "error",
                "payload": "Message is too long",
            }


def test_websocket_rejects_invalid_runtime_display_name(client):
    session_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    session_id = _create_chat_session(client, session_cookie=session_cookie)
    short_id = _resolve_short_id(client, session_cookie=session_cookie)

    with client.websocket_connect(f"/ws?sessionId={session_id}", cookies={COOKIE_NAME: session_cookie}) as ws:
        assert _receive_json_ignoring_presence(ws) == {
            "type": "user-info",
            "payload": {"id": session_id, "name": "Left", "short_id": short_id, "state": "idle"},
        }

        ws.send_json({"type": "user-info", "payload": {"name": "x" * 81}})
        assert _receive_json_ignoring_presence(ws) == {
            "type": "error",
            "payload": "Display name is invalid",
        }


def test_websocket_reconnect_preserves_existing_match(client):
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

            ws_right.close()
            time.sleep(0.2)

            with client.websocket_connect(
                f"/ws?sessionId={right_id}",
                cookies={COOKIE_NAME: right_cookie},
            ) as ws_right_reconnected:
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "user-info",
                    "payload": {"id": right_id, "name": "Right", "short_id": right_short_id, "state": "connected"},
                }
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "match",
                    "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "connected"},
                }

                ws_left.send_json({"type": "message", "payload": {"message": "still there?"}})
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "message",
                    "payload": {"id": left_id, "name": "Left", "message": "still there?"},
                }


def test_close_session_hint_does_not_disconnect_reconnected_socket(client):
    session_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    session_id = _create_chat_session(client, session_cookie=session_cookie)
    short_id = _resolve_short_id(client, session_cookie=session_cookie)

    with client.websocket_connect(f"/ws?sessionId={session_id}", cookies={COOKIE_NAME: session_cookie}) as ws:
        assert _receive_json_ignoring_presence(ws) == {
            "type": "user-info",
            "payload": {"id": session_id, "name": "Left", "short_id": short_id, "state": "idle"},
        }

    time.sleep(0.2)

    with client.websocket_connect(f"/ws?sessionId={session_id}", cookies={COOKIE_NAME: session_cookie}) as ws_reconnected:
        assert _receive_json_ignoring_presence(ws_reconnected) == {
            "type": "user-info",
            "payload": {"id": session_id, "name": "Left", "short_id": short_id, "state": "idle"},
        }

        response = client.post(
            "/api/session/close",
            json={"session_id": session_id},
            cookies={COOKIE_NAME: session_cookie},
        )

        assert response.status_code == 200
        assert response.json() == {"status": "accepted"}

        ws_reconnected.send_json({"type": "user-info", "payload": {"name": "Left Reloaded"}})
        assert _receive_json_ignoring_presence(ws_reconnected) == {
            "type": "user-info",
            "payload": {"id": session_id, "name": "Left Reloaded", "short_id": short_id, "state": "idle"},
        }


def test_websocket_reconnect_with_message_history_and_no_active_partner_does_not_replay_old_messages(client):
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

            ws_right.send_json({"type": "message", "payload": {"message": "hello from right"}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "message",
                "payload": {"id": right_id, "name": "Right", "message": "hello from right"},
            }

            _run(client.app.state.container.disconnect_session.execute(left_id, end_reason="next"))

    time.sleep(0.2)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_reconnected:
        assert _receive_json_ignoring_presence(ws_reconnected) == {
            "type": "user-info",
            "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "idle"},
        }
        ws_reconnected.send_json({"type": "user-info", "payload": {"name": "Left Idle"}})
        assert _receive_json_ignoring_presence(ws_reconnected) == {
            "type": "user-info",
            "payload": {"id": left_id, "name": "Left Idle", "short_id": left_short_id, "state": "idle"},
        }


def test_switch_match_then_refresh_does_not_replay_previous_match_messages(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")
    next_cookie = _register_and_verify(client, email="next@test.dev", display_name="Next")

    left_id = _create_chat_session(client, session_cookie=left_cookie)
    right_id = _create_chat_session(client, session_cookie=right_cookie)
    next_id = _create_chat_session(client, session_cookie=next_cookie)

    left_short_id = _resolve_short_id(client, session_cookie=left_cookie)
    right_short_id = _resolve_short_id(client, session_cookie=right_cookie)
    next_short_id = _resolve_short_id(client, session_cookie=next_cookie)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_left:
        with client.websocket_connect(f"/ws?sessionId={right_id}", cookies={COOKIE_NAME: right_cookie}) as ws_right:
            with client.websocket_connect(f"/ws?sessionId={next_id}", cookies={COOKIE_NAME: next_cookie}) as ws_next:
                assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
                assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
                assert _receive_json_ignoring_presence(ws_next)["type"] == "user-info"

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

                ws_right.send_json({"type": "message", "payload": {"message": "from right-old-match"}})
                assert _receive_json_ignoring_presence(ws_left) == {
                    "type": "message",
                    "payload": {"id": right_id, "name": "Right", "message": "from right-old-match"},
                }

                ws_left.send_json({"type": "queue", "payload": None})
                assert _receive_json_ignoring_presence(ws_left) == {
                    "type": "user-info",
                    "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "searching"},
                }
                assert _receive_json_ignoring_presence(ws_right) == {
                    "type": "disconnect",
                    "payload": None,
                }

                ws_next.send_json({"type": "queue", "payload": None})
                assert _receive_json_ignoring_presence(ws_next) == {
                    "type": "user-info",
                    "payload": {"id": next_id, "name": "Next", "short_id": next_short_id, "state": "searching"},
                }
                assert _receive_json_ignoring_presence(ws_next) == {
                    "type": "user-info",
                    "payload": {"id": next_id, "name": "Next", "short_id": next_short_id, "state": "connected"},
                }
                assert _receive_json_ignoring_presence(ws_next) == {
                    "type": "match",
                    "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "connected"},
                }
                assert _receive_json_ignoring_presence(ws_left) == {
                    "type": "user-info",
                    "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "connected"},
                }
                assert _receive_json_ignoring_presence(ws_left) == {
                    "type": "match",
                    "payload": {"id": next_id, "name": "Next", "short_id": next_short_id, "state": "connected"},
                }

        ws_left.close()
        time.sleep(0.2)

    with client.websocket_connect(f"/ws?sessionId={left_id}", cookies={COOKIE_NAME: left_cookie}) as ws_left_reconnected:
        assert _receive_json_ignoring_presence(ws_left_reconnected) == {
            "type": "user-info",
            "payload": {"id": left_id, "name": "Left", "short_id": left_short_id, "state": "connected"},
        }
        assert _receive_json_ignoring_presence(ws_left_reconnected) == {
            "type": "match",
            "payload": {"id": next_id, "name": "Next", "short_id": next_short_id, "state": "connected"},
        }

        ws_left_reconnected.send_json({"type": "user-info", "payload": {"name": "Left New Match"}})
        assert _receive_json_ignoring_presence(ws_left_reconnected) == {
            "type": "user-info",
            "payload": {"id": left_id, "name": "Left New Match", "short_id": left_short_id, "state": "connected"},
        }


def test_create_match_closes_overlapping_active_match_for_shared_session(client):
    left_cookie = _register_and_verify(client, email="left@test.dev", display_name="Left")
    middle_cookie = _register_and_verify(client, email="middle@test.dev", display_name="Middle")
    right_cookie = _register_and_verify(client, email="right@test.dev", display_name="Right")

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
