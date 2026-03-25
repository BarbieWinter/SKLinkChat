from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from typing import cast

from fastapi import FastAPI
from starlette.websockets import WebSocket

from app.bootstrap.container import ApplicationContainer
from app.shared.protocol import PayloadType

PRESENCE_BROADCAST_DEBOUNCE_SECONDS = 0.15


async def _broadcast_presence_count(app: FastAPI, container: ApplicationContainer) -> None:
    await asyncio.sleep(PRESENCE_BROADCAST_DEBOUNCE_SECONDS)

    online_count = (await container.online_user_count.execute())["online_count"]
    payload = {
        "type": PayloadType.PRESENCE_COUNT.value,
        "payload": {"online_count": online_count},
    }

    stale: list[tuple[str, WebSocket]] = []

    for session_id, websocket in container.connection_hub.snapshot():
        try:
            await cast(Awaitable[None], websocket.send_json(payload))
        except RuntimeError:
            stale.append((session_id, websocket))

    for session_id, websocket in stale:
        container.connection_hub.unregister_ws(session_id, websocket)


def schedule_presence_count_broadcast(app: FastAPI, container: ApplicationContainer) -> None:
    pending_task = getattr(app.state, "presence_broadcast_task", None)
    if pending_task is not None and not pending_task.done():
        pending_task.cancel()

    task = asyncio.create_task(_broadcast_presence_count(app, container))
    app.state.presence_broadcast_task = task

    def _clear_task(completed_task: asyncio.Task[None]) -> None:
        if getattr(app.state, "presence_broadcast_task", None) is completed_task:
            app.state.presence_broadcast_task = None

    task.add_done_callback(_clear_task)
