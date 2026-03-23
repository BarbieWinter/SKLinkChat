from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.bootstrap.container import build_container
from app.infrastructure.redis.client import close_redis_client, init_redis_client
from app.shared.config import get_settings
from app.shared.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = logging.getLogger("app")
    redis = init_redis_client()
    container = build_container(settings=settings, redis=redis)
    app.state.container = container
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

    app.state.expiration_task = asyncio.create_task(expire_disconnected_sessions())
    logger.info("application startup")
    yield
    app.state.expiration_task.cancel()
    try:
        await app.state.expiration_task
    except asyncio.CancelledError:
        pass
    await close_redis_client()
    logger.info("application shutdown")
