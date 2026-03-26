from __future__ import annotations

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, Field

from app.application.admin.service import (
    serialize_audit_event,
    serialize_report_detail,
    serialize_report_list_item,
    serialize_restricted_account_item,
)
from app.presentation.http.dependencies import ContainerDep, CurrentAdminAccountDep
from app.presentation.ws.disconnect_notices import cancel_pending_partner_disconnect_notice
from app.presentation.ws.presence_updates import schedule_presence_count_broadcast
from app.shared.errors import AppError
from app.shared.protocol import PayloadType

router = APIRouter()


class ReviewReportRequest(BaseModel):
    status: str = Field(..., min_length=1)
    review_note: str = Field(..., min_length=1, max_length=2000)


class AccountActionRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)
    source_report_id: int | None = Field(default=None, ge=1)


def _make_envelope(payload_type: PayloadType, payload: object) -> dict[str, object]:
    return {"type": payload_type.value, "payload": payload}


async def _broadcast_disconnect_to_partner(container, partner_session_id: str | None) -> None:
    if not partner_session_id:
        return
    envelope = _make_envelope(PayloadType.DISCONNECT, None)
    for websocket in container.connection_hub.get_all(partner_session_id):
        try:
            await websocket.send_json(envelope)
        except Exception:
            pass


async def _force_revoke_chat_session(
    request: Request,
    container,
    *,
    session_id: str,
    close_reason: str,
    websocket_close_reason: str,
) -> None:
    active_websockets = container.connection_hub.get_all(session_id)
    partner_session_id = await container.revoke_chat_session.execute(session_id, close_reason=close_reason)
    cancel_pending_partner_disconnect_notice(request.app, session_id)
    schedule_presence_count_broadcast(request.app, container)
    await _broadcast_disconnect_to_partner(container, partner_session_id)

    for websocket in active_websockets:
        try:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=websocket_close_reason,
            )
        except RuntimeError:
            pass


@router.get("/api/admin/reports")
async def list_reports(
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
    status: str | None = Query(default=None),
    reason: str | None = Query(default=None),
    limit: int = Query(default=20),
    offset: int = Query(default=0),
) -> dict[str, object]:
    _ = admin_account_id
    reports = await container.admin_governance_service.list_reports(
        status=status,
        reason=reason,
        limit=limit,
        offset=offset,
    )
    return {"items": [serialize_report_list_item(report) for report in reports]}


@router.get("/api/admin/reports/{report_id}")
async def get_report_detail(
    report_id: int,
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    _ = admin_account_id
    detail = await container.admin_governance_service.get_report_detail(report_id=report_id)
    return serialize_report_detail(detail)


@router.post("/api/admin/reports/{report_id}/review")
async def review_report(
    report_id: int,
    payload: ReviewReportRequest,
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    detail = await container.admin_governance_service.review_report(
        reviewer_account_id=admin_account_id,
        report_id=report_id,
        status=payload.status,
        review_note=payload.review_note,
    )
    return serialize_report_detail(detail)


@router.get("/api/admin/audit-events")
async def list_audit_events(
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
    event_type: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    chat_session_id: str | None = Query(default=None),
    limit: int = Query(default=20),
    offset: int = Query(default=0),
) -> dict[str, object]:
    _ = admin_account_id
    events = await container.admin_governance_service.list_audit_events(
        event_type=event_type,
        account_id=account_id,
        chat_session_id=chat_session_id,
        limit=limit,
        offset=offset,
    )
    return {"items": [serialize_audit_event(event) for event in events]}


@router.get("/api/admin/restricted-accounts")
async def list_restricted_accounts(
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
    limit: int = Query(default=20),
    offset: int = Query(default=0),
) -> dict[str, object]:
    _ = admin_account_id
    items = await container.admin_governance_service.list_restricted_accounts(limit=limit, offset=offset)
    return {"items": [serialize_restricted_account_item(item) for item in items]}


@router.post("/api/admin/accounts/{account_id}/restrict")
async def restrict_account(
    request: Request,
    account_id: str,
    payload: AccountActionRequest,
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    if account_id == admin_account_id:
        raise AppError(message="Cannot restrict your own account", code="INVALID_ADMIN_TARGET", status_code=422)

    result = await container.admin_governance_service.restrict_account(
        admin_account_id=admin_account_id,
        account_id=account_id,
        reason=payload.reason,
        source_report_id=payload.source_report_id,
    )
    if result.active_chat_session_id:
        await _force_revoke_chat_session(
            request,
            container,
            session_id=result.active_chat_session_id,
            close_reason="restricted",
            websocket_close_reason="CHAT_ACCESS_RESTRICTED",
        )

    return {
        "account_id": result.account_id,
        "chat_access_restricted": result.chat_access_restricted,
    }


@router.post("/api/admin/accounts/{account_id}/restore")
async def restore_account(
    account_id: str,
    payload: AccountActionRequest,
    admin_account_id: CurrentAdminAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    result = await container.admin_governance_service.restore_account(
        admin_account_id=admin_account_id,
        account_id=account_id,
        reason=payload.reason,
    )
    return {
        "account_id": result.account_id,
        "chat_access_restricted": result.chat_access_restricted,
    }
