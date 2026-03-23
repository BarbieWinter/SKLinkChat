import app.bootstrap.lifespan as lifespan_module
from app.main import create_app
from tests.fakes import FakeRedis


def test_healthz_returns_ok(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz_returns_ready_with_healthy_redis(client):
    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readyz_returns_503_when_redis_fails(monkeypatch):
    class FailingRedis(FakeRedis):
        async def ping(self):
            raise RuntimeError("redis down")

    async def noop_close_redis_client() -> None:
        return None

    monkeypatch.setattr(lifespan_module, "init_redis_client", lambda: FailingRedis())
    monkeypatch.setattr(lifespan_module, "close_redis_client", noop_close_redis_client)
    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/readyz", headers={"x-request-id": "req-ready-fail"})

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "REDIS_UNAVAILABLE"
    assert body["request_id"] == "req-ready-fail"


def test_users_count_returns_online_count_from_redis(monkeypatch):
    async def noop_close_redis_client() -> None:
        return None

    fake_redis = FakeRedis()
    monkeypatch.setattr(lifespan_module, "init_redis_client", lambda: fake_redis)
    monkeypatch.setattr(lifespan_module, "close_redis_client", noop_close_redis_client)
    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        for index in range(7):
            fake_redis._sets.setdefault("presence:online:sessions", set()).add(f"session-{index}")
        response = client.get("/api/users/count")

    assert response.status_code == 200
    assert response.json() == {"online_count": 7}


def test_session_endpoint_allows_local_frontend_origin(client):
    response = client.post(
        "/api/session",
        headers={"Origin": "http://localhost:4173"},
    )

    assert response.status_code == 200
    assert "session_id" in response.json()
    assert response.headers["access-control-allow-origin"] == "http://localhost:4173"
