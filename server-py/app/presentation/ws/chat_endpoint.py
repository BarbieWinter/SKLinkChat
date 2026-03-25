from __future__ import annotations

from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketException, status
from starlette.websockets import WebSocketDisconnect

from app.bootstrap.container import ApplicationContainer
from app.domain.chat.models import ChatSession
from app.presentation.ws.disconnect_notices import cancel_pending_partner_disconnect_notice
from app.presentation.ws.presence_updates import schedule_presence_count_broadcast
from app.shared.errors import AppError
from app.shared.protocol import PayloadType

router = APIRouter()


def _serialize_user(session: ChatSession) -> dict[str, Any]:
    return {
        "id": session.session_id,
        "name": session.name,
        "state": session.state.value,
    }


def _make_envelope(payload_type: PayloadType, payload: Any) -> dict[str, Any]:
    return {"type": payload_type.value, "payload": payload}


async def _send_envelope(websocket: WebSocket, payload_type: PayloadType, payload: Any) -> None:
    await websocket.send_json(_make_envelope(payload_type, payload))


async def _send_error(websocket: WebSocket, message: str) -> None:
    await _send_envelope(websocket, PayloadType.ERROR, message)


async def _broadcast_to_session(container: ApplicationContainer, session_id: str, payload_type: PayloadType, payload: Any) -> None:
    """Send a message to ALL WebSocket connections for a given session (all tabs)."""
    envelope = _make_envelope(payload_type, payload)
    for ws in container.connection_hub.get_all(session_id):
        try:
            await ws.send_json(envelope)
        except Exception:
            pass


async def _send_match_notifications(container: ApplicationContainer, match) -> None:
    await _broadcast_to_session(container, match.left.session_id, PayloadType.USER_INFO, _serialize_user(match.left))
    await _broadcast_to_session(container, match.left.session_id, PayloadType.MATCH, _serialize_user(match.right))

    await _broadcast_to_session(container, match.right.session_id, PayloadType.USER_INFO, _serialize_user(match.right))
    await _broadcast_to_session(container, match.right.session_id, PayloadType.MATCH, _serialize_user(match.left))


async def _handle_user_info(
    container: ApplicationContainer,
    websocket: WebSocket,
    *,
    session_id: str,
    payload: Any,
) -> None:
    if not isinstance(payload, dict):
        await _send_error(websocket, "Malformed payload")
        return

    name = payload.get("name")
    if name is not None and not isinstance(name, str):
        await _send_error(websocket, "Malformed payload")
        return

    session = await container.update_profile.execute(session_id, name=name)
    await _broadcast_to_session(container, session_id, PayloadType.USER_INFO, _serialize_user(session))


async def _notify_partner_disconnect(container: ApplicationContainer, partner_session_id: str | None) -> None:
    if partner_session_id is None:
        return
    await _broadcast_to_session(container, partner_session_id, PayloadType.DISCONNECT, None)


async def _disconnect_current_chat(container: ApplicationContainer, session_id: str) -> None:
    await container.disconnect_session.execute(session_id)
    await _broadcast_to_session(container, session_id, PayloadType.DISCONNECT, None)


async def _handle_queue(container: ApplicationContainer, websocket: WebSocket, *, session_id: str) -> None:
    partner_disconnected = await container.disconnect_session.execute(session_id)
    await _notify_partner_disconnect(container, partner_disconnected)

    session = await container.enter_queue.execute(session_id)
    await _broadcast_to_session(container, session_id, PayloadType.USER_INFO, _serialize_user(session))

    match = await container.try_match.execute()
    if match is not None:
        await _send_match_notifications(container, match)


async def _handle_message(
    container: ApplicationContainer,
    websocket: WebSocket,
    *,
    session_id: str,
    payload: Any,
) -> None:
    if not isinstance(payload, dict):
        await _send_error(websocket, "Malformed payload")
        return

    raw_message = payload.get("message")
    if not isinstance(raw_message, str):
        await _send_error(websocket, "Malformed payload")
        return

    message_result = await container.send_message.execute(session_id, raw_message)
    if message_result is None:
        await _disconnect_current_chat(container, session_id=session_id)
        return

    sender, partner, normalized_message = message_result
    message_payload = {"id": sender.session_id, "name": sender.name, "message": normalized_message}

    partner_has_connection = container.connection_hub.has(partner.session_id)
    if not partner_has_connection:
        if partner.is_reconnect_pending:
            await _send_error(websocket, "Partner temporarily unavailable")
            return

        await _disconnect_current_chat(container, session_id=session_id)
        return

    # Deliver to all partner tabs
    await _broadcast_to_session(container, partner.session_id, PayloadType.MESSAGE, message_payload)


async def _handle_typing(
    container: ApplicationContainer,
    websocket: WebSocket,
    *,
    session_id: str,
    payload: Any,
) -> None:
    if not isinstance(payload, dict):
        await _send_error(websocket, "Malformed payload")
        return

    typing = payload.get("typing")
    if not isinstance(typing, bool):
        await _send_error(websocket, "Malformed payload")
        return

    partner_id = await container.set_typing.execute(session_id, is_typing=typing)
    if partner_id is None:
        await _disconnect_current_chat(container, session_id=session_id)
        return

    partner_has_connection = container.connection_hub.has(partner_id)
    if not partner_has_connection:
        partner = await container.lookup_partner.execute(session_id)
        if partner is not None and partner.is_reconnect_pending:
            return

        await _disconnect_current_chat(container, session_id=session_id)
        return

    await _broadcast_to_session(container, partner_id, PayloadType.TYPING, {"id": session_id, "typing": typing})


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, sessionId: str) -> None:
    container: ApplicationContainer = websocket.app.state.container
    raw_session_token = websocket.cookies.get(container.settings.auth_cookie_name)
    account_id, auth_session = await container.resolve_auth_session.execute(raw_session_token)
    if account_id is None or not auth_session.authenticated:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="UNAUTHENTICATED")
    try:
        authorized_session = await container.authorize_chat_session.execute(account_id=account_id, session_id=sessionId)
    except AppError as error:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=error.code) from error
    await websocket.accept()
    cancel_pending_partner_disconnect_notice(websocket.app, sessionId)
    session = await container.bootstrap_connection.execute(
        sessionId,
        websocket,
        display_name=authorized_session.display_name,
    )
    schedule_presence_count_broadcast(websocket.app, container)
    await _send_envelope(websocket, PayloadType.USER_INFO, _serialize_user(session))
    if session.partner_id is not None:
        partner = await container.lookup_partner.execute(sessionId)
        if partner is not None:
            await _send_envelope(websocket, PayloadType.MATCH, _serialize_user(partner))

    try:
        while True:
            data = await websocket.receive_json()
            payload_type = data.get("type")
            payload = data.get("payload")

            if payload_type == PayloadType.USER_INFO.value:
                await _handle_user_info(container, websocket, session_id=sessionId, payload=payload)
            elif payload_type == PayloadType.QUEUE.value:
                await _handle_queue(container, websocket, session_id=sessionId)
            elif payload_type == PayloadType.MESSAGE.value:
                await _handle_message(container, websocket, session_id=sessionId, payload=payload)
            elif payload_type == PayloadType.TYPING.value:
                await _handle_typing(container, websocket, session_id=sessionId, payload=payload)
            else:
                await _send_error(websocket, "Unsupported payload type")
    except WebSocketDisconnect:
        # Remove only this specific WebSocket from the hub.
        remaining = container.connection_hub.unregister_ws(sessionId, websocket)
        # Only tear down the session if this was the last tab.
        if remaining == 0:
            await container.mark_disconnected.execute(sessionId)
            schedule_presence_count_broadcast(websocket.app, container)
