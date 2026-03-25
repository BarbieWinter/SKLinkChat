from __future__ import annotations

import json
from urllib.parse import parse_qs

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.presentation.http.dependencies import ContainerDep, CurrentAccountDep
from app.presentation.ws.disconnect_notices import (
    cancel_pending_partner_disconnect_notice,
    schedule_partner_disconnect_notice,
)
from app.presentation.ws.presence_updates import schedule_presence_count_broadcast

router = APIRouter()


class CloseSessionRequest(BaseModel):
    session_id: str


async def _extract_close_session_payload(request: Request) -> CloseSessionRequest:
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        payload = json.loads(body.decode("utf-8"))
        return CloseSessionRequest.model_validate(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        parsed_body = parse_qs(body.decode("utf-8"))
        session_id = parsed_body.get("session_id", [None])[0]
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required") from None
        return CloseSessionRequest(session_id=session_id)


@router.post("/api/session")
async def create_session(account_id: CurrentAccountDep, container: ContainerDep) -> dict[str, str]:
    return await container.create_chat_session.execute(account_id)


@router.post("/api/session/close")
async def close_session(
    request: Request,
    account_id: CurrentAccountDep,
    container: ContainerDep,
) -> dict[str, str]:
    payload = await _extract_close_session_payload(request)
    await container.authorize_chat_session.execute(account_id=account_id, session_id=payload.session_id)

    active_websockets = container.connection_hub.get_all(payload.session_id)
    await container.mark_disconnected.execute(payload.session_id, force=True)
    schedule_presence_count_broadcast(request.app, container)
    cancel_pending_partner_disconnect_notice(request.app, payload.session_id)
    schedule_partner_disconnect_notice(request.app, container, payload.session_id)

    for ws in active_websockets:
        try:
            await ws.close()
        except RuntimeError:
            pass

    return {"status": "accepted"}
