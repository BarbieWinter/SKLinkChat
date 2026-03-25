from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.presentation.http.dependencies import ContainerDep, CurrentAccountDep

router = APIRouter()


class CreateChatReportRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    reported_session_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    details: str | None = Field(default=None, max_length=2000)


@router.post("/api/chat/reports")
async def create_chat_report(
    payload: CreateChatReportRequest,
    account_id: CurrentAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    receipt = await container.submit_chat_report.execute(
        account_id=account_id,
        session_id=payload.session_id,
        reported_session_id=payload.reported_session_id,
        reason=payload.reason,
        details=payload.details,
    )
    return {"status": receipt.status, "report_id": receipt.report_id}
