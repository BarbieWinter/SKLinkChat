import json
from typing import Annotated
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import get_container
from app.presentation.ws.disconnect_notices import (
    cancel_pending_partner_disconnect_notice,
    schedule_partner_disconnect_notice,
)

router = APIRouter()
ContainerDep = Annotated[ApplicationContainer, Depends(get_container)]


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
async def create_session(container: ContainerDep) -> dict[str, str]:
    return container.create_anonymous_session.execute()


@router.post("/api/session/close")
async def close_session(request: Request, container: ContainerDep) -> dict[str, str]:
    # A page-close beacon is treated as an intentional leave signal, which is different from a flaky network drop.
    payload = await _extract_close_session_payload(request)
    session_id = payload.session_id

    active_websocket = container.connection_hub.get(session_id)
    await container.mark_disconnected.execute(session_id)
    cancel_pending_partner_disconnect_notice(request.app, session_id)
    schedule_partner_disconnect_notice(request.app, container, session_id)

    if active_websocket is not None:
        try:
            await active_websocket.close()
        except RuntimeError:
            pass

    return {"status": "accepted"}
