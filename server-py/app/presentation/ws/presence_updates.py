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
        except Exception:
            stale.append((session_id, websocket))

    stale_sessions_gone: list[str] = []
    for session_id, websocket in stale:
        remaining = container.connection_hub.unregister_ws(session_id, websocket)
        if remaining == 0:
            stale_sessions_gone.append(session_id)

    if stale_sessions_gone:
        # Mark each orphaned session as disconnected (updates Redis presence count),
        # then schedule a follow-up broadcast so clients see the corrected count.
        async def _cleanup_stale_and_rebroadcast() -> None:
            for sid in stale_sessions_gone:
                await container.mark_disconnected.execute(sid)
            schedule_presence_count_broadcast(app, container)

        asyncio.create_task(_cleanup_stale_and_rebroadcast())


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
