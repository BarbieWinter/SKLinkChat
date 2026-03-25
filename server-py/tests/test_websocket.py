import asyncio
import time
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

import app.bootstrap.lifespan as lifespan_module
import app.main as main_module
from app.application.chat.runtime_service import ChatRuntimeService
from app.infrastructure.feature_flags import NoOpFeatureFlagEvaluator
from app.infrastructure.jobs.inline_job_dispatcher import InlineJobDispatcher
from app.infrastructure.moderation_gateway import NoOpModerationGateway
from app.infrastructure.observability.noop_audit_sink import NoOpAuditSink
from app.infrastructure.permission_gate import NoOpPermissionGate
from app.infrastructure.realtime.in_memory_connection_hub import InMemoryConnectionHub
from app.infrastructure.redis.presence_repository import RedisPresenceRepository
from app.infrastructure.redis.redis_event_bus import RedisEventBus
from app.infrastructure.redis.session_repository import RedisSessionRepository
from tests.fakes import FakeRedis


@pytest.fixture
def websocket_client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    fake_redis = FakeRedis()

    async def noop_close_redis_client() -> None:
        return None

    monkeypatch.setattr(lifespan_module, "init_redis_client", lambda: fake_redis)
    monkeypatch.setattr(lifespan_module, "close_redis_client", noop_close_redis_client)

    app = main_module.create_app()
    with TestClient(app) as client:
        yield client


def _queue_and_match(ws_left, ws_right, left_id: str, right_id: str) -> None:
    ws_left.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {
            "id": left_id,
            "name": "Anonymous-0001",
            "state": "searching",
        },
    }

    ws_right.send_json({"type": "queue", "payload": None})
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {
            "id": right_id,
            "name": "Anonymous-0002",
            "state": "searching",
        },
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "user-info",
        "payload": {
            "id": right_id,
            "name": "Anonymous-0002",
            "state": "connected",
        },
    }
    assert _receive_json_ignoring_presence(ws_right) == {
        "type": "match",
        "payload": {
            "id": left_id,
            "name": "Anonymous-0001",
            "state": "connected",
        },
    }

    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "user-info",
        "payload": {
            "id": left_id,
            "name": "Anonymous-0001",
            "state": "connected",
        },
    }
    assert _receive_json_ignoring_presence(ws_left) == {
        "type": "match",
        "payload": {
            "id": right_id,
            "name": "Anonymous-0002",
            "state": "connected",
        },
    }


def _receive_json_ignoring_presence(ws):
    while True:
        message = ws.receive_json()
        if message["type"] != "presence-count":
            return message


def test_websocket_connect_sends_initial_user_info(websocket_client: TestClient):
    with websocket_client.websocket_connect("/ws?sessionId=session-initial") as ws:
        assert _receive_json_ignoring_presence(ws) == {
            "type": "user-info",
            "payload": {
                "id": "session-initial",
                "name": "Anonymous-0001",
                "state": "idle",
            },
        }


def test_websocket_queue_match_message_and_typing_flow(websocket_client: TestClient):
    left_id = "session-left"
    right_id = "session-right"

    with websocket_client.websocket_connect(f"/ws?sessionId={left_id}") as ws_left:
        with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right:
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "user-info",
                "payload": {
                    "id": left_id,
                    "name": "Anonymous-0001",
                    "state": "idle",
                },
            }
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "user-info",
                "payload": {
                    "id": right_id,
                    "name": "Anonymous-0002",
                    "state": "idle",
                },
            }

            _queue_and_match(ws_left, ws_right, left_id=left_id, right_id=right_id)

            ws_left.send_json({"type": "message", "payload": {"message": "  hello partner  "}})
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "message",
                "payload": {
                    "id": left_id,
                    "name": "Anonymous-0001",
                    "message": "hello partner",
                },
            }

            ws_right.send_json({"type": "typing", "payload": {"typing": True}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "typing",
                "payload": {
                    "id": right_id,
                    "typing": True,
                },
            }


def test_websocket_partner_disconnect_emits_disconnect_event(websocket_client: TestClient):
    left_id = "session-disconnect-left"
    right_id = "session-disconnect-right"

    with websocket_client.websocket_connect(f"/ws?sessionId={left_id}") as ws_left:
        assert _receive_json_ignoring_presence(ws_left) == {
            "type": "user-info",
            "payload": {
                "id": left_id,
                "name": "Anonymous-0001",
                "state": "idle",
            },
        }

        with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right:
            assert _receive_json_ignoring_presence(ws_right) == {
                "type": "user-info",
                "payload": {
                    "id": right_id,
                    "name": "Anonymous-0002",
                    "state": "idle",
                },
            }
            _queue_and_match(ws_left, ws_right, left_id=left_id, right_id=right_id)
            response = websocket_client.post("/api/session/close", json={"session_id": right_id})
            assert response.status_code == 200
            assert response.json() == {"status": "accepted"}

        time.sleep(1.2)
        assert _receive_json_ignoring_presence(ws_left) == {"type": "disconnect", "payload": None}


def test_websocket_reconnect_within_window_restores_existing_match(websocket_client: TestClient):
    left_id = "session-reconnect-left"
    right_id = "session-reconnect-right"

    with websocket_client.websocket_connect(f"/ws?sessionId={left_id}") as ws_left:
        with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right:
            assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
            assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
            _queue_and_match(ws_left, ws_right, left_id=left_id, right_id=right_id)

            ws_right.close()
            time.sleep(0.2)

            with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right_reconnected:
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "user-info",
                    "payload": {
                        "id": right_id,
                        "name": "Anonymous-0002",
                        "state": "connected",
                    },
                }
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "match",
                    "payload": {
                        "id": left_id,
                        "name": "Anonymous-0001",
                        "state": "connected",
                    },
                }

                time.sleep(1.2)
                ws_left.send_json({"type": "message", "payload": {"message": "still there?"}})
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "message",
                    "payload": {
                        "id": left_id,
                        "name": "Anonymous-0001",
                        "message": "still there?",
                    },
                }


def test_websocket_message_after_partner_disconnect_emits_disconnect(websocket_client: TestClient):
    left_id = "session-message-left"
    right_id = "session-message-right"

    with websocket_client.websocket_connect(f"/ws?sessionId={left_id}") as ws_left:
        with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right:
            assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
            assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
            _queue_and_match(ws_left, ws_right, left_id=left_id, right_id=right_id)

            response = websocket_client.post("/api/session/close", json={"session_id": right_id})
            assert response.status_code == 200
            assert response.json() == {"status": "accepted"}
            time.sleep(1.2)

            ws_left.send_json({"type": "message", "payload": {"message": "are you there?"}})
            assert _receive_json_ignoring_presence(ws_left) == {"type": "disconnect", "payload": None}


def test_websocket_transport_disconnect_preserves_chat_until_reconnect(websocket_client: TestClient):
    left_id = "session-network-left"
    right_id = "session-network-right"

    with websocket_client.websocket_connect(f"/ws?sessionId={left_id}") as ws_left:
        with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right:
            assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
            assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
            _queue_and_match(ws_left, ws_right, left_id=left_id, right_id=right_id)

            ws_right.close()
            time.sleep(1.2)

            ws_left.send_json({"type": "message", "payload": {"message": "hold on"}})
            assert _receive_json_ignoring_presence(ws_left) == {
                "type": "error",
                "payload": "Partner temporarily unavailable",
            }

            with websocket_client.websocket_connect(f"/ws?sessionId={right_id}") as ws_right_reconnected:
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "user-info",
                    "payload": {
                        "id": right_id,
                        "name": "Anonymous-0002",
                        "state": "connected",
                    },
                }
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "match",
                    "payload": {
                        "id": left_id,
                        "name": "Anonymous-0001",
                        "state": "connected",
                    },
                }

                ws_left.send_json({"type": "message", "payload": {"message": "welcome back"}})
                assert _receive_json_ignoring_presence(ws_right_reconnected) == {
                    "type": "message",
                    "payload": {
                        "id": left_id,
                        "name": "Anonymous-0001",
                        "message": "welcome back",
                    },
                }


def test_websocket_presence_count_broadcasts_latest_online_total(websocket_client: TestClient):
    with websocket_client.websocket_connect("/ws?sessionId=presence-left") as ws_left:
        assert _receive_json_ignoring_presence(ws_left)["type"] == "user-info"
        time.sleep(0.2)

        assert ws_left.receive_json() == {
            "type": "presence-count",
            "payload": {
                "online_count": 1,
            },
        }

        with websocket_client.websocket_connect("/ws?sessionId=presence-right") as ws_right:
            assert _receive_json_ignoring_presence(ws_right)["type"] == "user-info"
            time.sleep(0.2)

            right_count_message = {
                "type": "presence-count",
                "payload": {
                    "online_count": 2,
                },
            }
            assert ws_left.receive_json() == right_count_message
            assert ws_right.receive_json() == right_count_message


def test_runtime_state_survives_service_restart():
    class DummyWebSocket:
        pass

    async def scenario() -> None:
        fake_redis = FakeRedis()

        first_runtime = ChatRuntimeService(
            RedisSessionRepository(fake_redis, history_limit=20, default_name_prefix="Anonymous"),
            InMemoryConnectionHub(),
            RedisPresenceRepository(fake_redis),
            NoOpPermissionGate(),
            NoOpFeatureFlagEvaluator(),
            NoOpModerationGateway(),
            NoOpAuditSink(),
            RedisEventBus(),
            InlineJobDispatcher(),
            reconnect_window_seconds=60,
        )
        await first_runtime.prepare_for_startup()
        await first_runtime.register_connection("restart-left", DummyWebSocket())
        await first_runtime.register_connection("restart-right", DummyWebSocket())
        await first_runtime.enter_queue("restart-left")
        await first_runtime.enter_queue("restart-right")

        match = await first_runtime.try_match()
        assert match is not None
        assert match.left.partner_id == "restart-right"
        assert match.right.partner_id == "restart-left"

        restarted_runtime = ChatRuntimeService(
            RedisSessionRepository(fake_redis, history_limit=20, default_name_prefix="Anonymous"),
            InMemoryConnectionHub(),
            RedisPresenceRepository(fake_redis),
            NoOpPermissionGate(),
            NoOpFeatureFlagEvaluator(),
            NoOpModerationGateway(),
            NoOpAuditSink(),
            RedisEventBus(),
            InlineJobDispatcher(),
            reconnect_window_seconds=60,
        )
        await restarted_runtime.prepare_for_startup()

        left_session = await restarted_runtime.get_or_create_session("restart-left")
        right_session = await restarted_runtime.get_or_create_session("restart-right")
        assert left_session.partner_id == "restart-right"
        assert right_session.partner_id == "restart-left"
        assert left_session.is_reconnect_pending is True
        assert right_session.is_reconnect_pending is True

        await restarted_runtime.register_connection("restart-left", DummyWebSocket())
        await restarted_runtime.register_connection("restart-right", DummyWebSocket())

        restored_partner = await restarted_runtime.lookup_current_partner("restart-left")
        assert restored_partner is not None
        assert restored_partner.session_id == "restart-right"

    asyncio.run(scenario())
