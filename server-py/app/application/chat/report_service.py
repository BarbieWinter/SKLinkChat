from __future__ import annotations

from dataclasses import dataclass

from app.application.chat.access_service import ChatAccessService
from app.application.platform.services import DurableChatRepository
from app.shared.errors import AppError

REPORT_REASONS = frozenset(
    {
        "harassment",
        "sexual_content",
        "spam",
        "hate_speech",
        "other",
    }
)


@dataclass(slots=True, frozen=True)
class ChatReportReceipt:
    report_id: int
    status: str = "accepted"


class ChatReportService:
    def __init__(
        self,
        *,
        chat_access_service: ChatAccessService,
        durable_chat_repository: DurableChatRepository,
    ) -> None:
        self._chat_access_service = chat_access_service
        self._durable_chat_repository = durable_chat_repository

    async def submit_report(
        self,
        *,
        account_id: str,
        session_id: str,
        reported_session_id: str,
        reason: str,
        details: str | None,
    ) -> ChatReportReceipt:
        normalized_reason = reason.strip()
        normalized_details = details.strip() if details is not None else ""
        if normalized_reason not in REPORT_REASONS:
            raise AppError(message="Report reason is invalid", code="INVALID_REPORT_REASON", status_code=422)
        if session_id == reported_session_id:
            raise AppError(message="Cannot report yourself", code="INVALID_REPORT_TARGET", status_code=422)
        if normalized_reason == "other" and not normalized_details:
            raise AppError(
                message="Report details are required for this reason",
                code="REPORT_DETAILS_REQUIRED",
                status_code=422,
            )

        await self._chat_access_service.authorize_chat_session(account_id=account_id, session_id=session_id)
        active_match = await self._durable_chat_repository.get_active_match(
            chat_session_id=session_id,
            partner_session_id=reported_session_id,
        )
        if active_match is None:
            raise AppError(
                message="You can only report the active chat partner",
                code="CHAT_REPORT_FORBIDDEN",
                status_code=403,
            )

        report_id = await self._durable_chat_repository.create_report(
            reporter_account_id=account_id,
            chat_match_id=active_match.id,
            reported_chat_session_id=reported_session_id,
            reason=normalized_reason,
            details=normalized_details or None,
        )
        return ChatReportReceipt(report_id=report_id)
