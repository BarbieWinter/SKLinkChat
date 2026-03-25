import asyncio
import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine

os.environ.setdefault("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SERVER_PY_DATABASE_URL", "sqlite+aiosqlite:///./tests/test_app.sqlite3")
os.environ.setdefault("SERVER_PY_EMAIL_PROVIDER", "fake")
os.environ.setdefault("SERVER_PY_TURNSTILE_PROVIDER", "fake")
os.environ.setdefault("SERVER_PY_FRONTEND_BASE_URL", "http://localhost:4173")

import app.bootstrap.lifespan as lifespan_module
from app.infrastructure.postgres.database import Base, close_database
from app.main import create_app
from app.shared.config import get_settings
from tests.fakes import FakeRedis


async def _prepare_database(database_url: str) -> None:
    engine = create_async_engine(database_url, future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()


@pytest.fixture(autouse=True)
def base_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Generator[None, None, None]:
    database_path = tmp_path / "test_app.sqlite3"
    monkeypatch.setenv("SERVER_PY_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", f"sqlite+aiosqlite:///{database_path}")
    monkeypatch.setenv("SERVER_PY_RECONNECT_WINDOW_SECONDS", "1")
    monkeypatch.setenv("SERVER_PY_PARTNER_DISCONNECT_GRACE_SECONDS", "1")
    monkeypatch.setenv("SERVER_PY_EMAIL_PROVIDER", "fake")
    monkeypatch.setenv("SERVER_PY_TURNSTILE_PROVIDER", "fake")
    monkeypatch.setenv("SERVER_PY_FRONTEND_BASE_URL", "http://localhost:4173")
    monkeypatch.setenv("SERVER_PY_FAKE_TURNSTILE_ALWAYS_PASS", "true")
    get_settings.cache_clear()
    asyncio.run(_prepare_database(f"sqlite+aiosqlite:///{database_path}"))
    yield
    asyncio.run(close_database())
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
