import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")

import app.bootstrap.lifespan as lifespan_module
from app.main import create_app
from app.shared.config import get_settings
from tests.fakes import FakeRedis


@pytest.fixture(autouse=True)
def base_env(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_RECONNECT_WINDOW_SECONDS", "1")
    monkeypatch.setenv("SERVER_PY_PARTNER_DISCONNECT_GRACE_SECONDS", "1")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def fake_redis() -> FakeRedis:
    return FakeRedis()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, fake_redis: FakeRedis) -> Generator[TestClient, None, None]:
    async def noop_close_redis_client() -> None:
        return None

    monkeypatch.setattr(lifespan_module, "init_redis_client", lambda: fake_redis)
    monkeypatch.setattr(lifespan_module, "close_redis_client", noop_close_redis_client)
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
