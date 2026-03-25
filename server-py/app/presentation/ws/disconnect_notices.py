import asyncio

from fastapi import FastAPI

from app.bootstrap.container import ApplicationContainer
from app.shared.protocol import PayloadType


def cancel_pending_partner_disconnect_notice(app: FastAPI, session_id: str) -> None:
    # A reconnect or a duplicate close signal should always cancel the older pending disconnect notice first.
    pending_tasks: dict[str, asyncio.Task[None]] = app.state.partner_disconnect_tasks
    pending_task = pending_tasks.pop(session_id, None)
    if pending_task is not None:
        pending_task.cancel()


def schedule_partner_disconnect_notice(app: FastAPI, container: ApplicationContainer, session_id: str) -> None:
    # An explicit page-close signal should disconnect the partner quickly, but still allow a short grace window.
    async def notify_if_session_stays_closed() -> None:
        try:
            await asyncio.sleep(container.settings.partner_disconnect_grace_seconds)
            if container.connection_hub.has(session_id):
                return

            partner_session_id = await container.disconnect_session.execute(session_id)
            if partner_session_id is None:
                return

            envelope = {"type": PayloadType.DISCONNECT.value, "payload": None}
            for ws in container.connection_hub.get_all(partner_session_id):
                try:
                    await ws.send_json(envelope)
                except Exception:
                    pass
        except asyncio.CancelledError:
            return
        finally:
            pending_tasks: dict[str, asyncio.Task[None]] = app.state.partner_disconnect_tasks
            pending_tasks.pop(session_id, None)

    pending_tasks: dict[str, asyncio.Task[None]] = app.state.partner_disconnect_tasks
    pending_tasks[session_id] = asyncio.create_task(notify_if_session_stays_closed())
