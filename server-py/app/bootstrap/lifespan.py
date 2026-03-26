from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.bootstrap.container import build_container
from app.infrastructure.postgres.database import close_database, init_database
from app.infrastructure.redis.client import close_redis_client, init_redis_client
from app.shared.config import get_settings
from app.shared.logging import configure_logging


async def _await_cancelled_task(task: asyncio.Task[None], *, logger: logging.Logger, task_name: str) -> None:
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("background task failed during shutdown", extra={"task_name": task_name})


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = logging.getLogger("app")
    redis = init_redis_client()
    session_factory = init_database(settings.normalized_database_url)
    container = build_container(settings=settings, redis=redis, session_factory=session_factory)
    app.state.container = container
    app.state.partner_disconnect_tasks = {}
    app.state.presence_broadcast_task = None
    await container.presence_repository.reset_online()
    await container.chat_runtime_service.prepare_for_startup()

    async def expire_disconnected_sessions() -> None:
        while True:
            partner_ids = await container.expire_stale_sessions.execute()
            for partner_id in partner_ids:
                partner_ws = container.connection_hub.get(partner_id)
                if partner_ws is not None:
                    await partner_ws.send_json({"type": "disconnect", "payload": None})
            await asyncio.sleep(1)

    async def run_retention_jobs() -> None:
        while True:
            await container.retention_service.run_once()
            await asyncio.sleep(settings.cleanup_interval_seconds)

    app.state.expiration_task = asyncio.create_task(expire_disconnected_sessions())
    app.state.retention_task = asyncio.create_task(run_retention_jobs())
    logger.info("application startup")
    yield
    for task in app.state.partner_disconnect_tasks.values():
        task.cancel()
    if app.state.presence_broadcast_task is not None:
        app.state.presence_broadcast_task.cancel()
    app.state.expiration_task.cancel()
    app.state.retention_task.cancel()
    for task_name, task in (
        ("expiration_task", app.state.expiration_task),
        ("retention_task", app.state.retention_task),
    ):
        await _await_cancelled_task(task, logger=logger, task_name=task_name)
    if app.state.presence_broadcast_task is not None:
        await _await_cancelled_task(
            app.state.presence_broadcast_task,
            logger=logger,
            task_name="presence_broadcast_task",
        )
    await close_redis_client()
    await close_database()
    logger.info("application shutdown")
