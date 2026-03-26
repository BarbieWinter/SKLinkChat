from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime

from app.application.auth.security import utc_now
from app.application.platform.services import DurableChatRepository
from app.infrastructure.postgres.repositories import (
    AccountRepository,
    AdminGovernanceRepository,
    AuditEventRepository,
)
from app.shared.errors import AppError

REPORT_REVIEW_STATUSES = frozenset({"reviewed", "dismissed", "actioned"})
REPORT_REASONS = frozenset({"harassment", "sexual_content", "spam", "hate_speech", "other"})
MAX_PAGE_SIZE = 50


def _mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    local_part, domain = email.split("@", 1)
    if len(local_part) <= 2:
        masked_local = f"{local_part[0]}*" if local_part else "*"
    else:
        masked_local = f"{local_part[:2]}***"
    return f"{masked_local}@{domain}"


@dataclass(slots=True, frozen=True)
class AdminReportListItem:
    id: int
    created_at: datetime
    reason: str
    status: str
    reporter_display_name: str
    reporter_short_id: str | None
    reporter_email_masked: str | None
    reported_display_name: str
    reported_short_id: str | None
    reported_email_masked: str | None
    reported_account_chat_access_restricted: bool
    reported_account_chat_access_restriction_report_id: int | None


@dataclass(slots=True, frozen=True)
class AdminReportDetail:
    id: int
    reason: str
    details: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None
    review_note: str | None
    chat_match_id: str
    reported_chat_session_id: str
    reporter_account_id: str
    reporter_display_name: str
    reporter_short_id: str | None
    reporter_email: str | None
    reported_account_id: str
    reported_display_name: str
    reported_short_id: str | None
    reported_email: str | None
    reported_account_chat_access_restricted: bool
    reported_account_chat_access_restricted_at: datetime | None
    reported_account_chat_access_restriction_reason: str | None
    reported_account_chat_access_restriction_report_id: int | None
    reported_account_chat_access_restriction_report_status: str | None
    governance_triggered_by_this_report: bool
    reviewer_account_id: str | None
    reviewer_display_name: str | None
    reviewer_email: str | None


@dataclass(slots=True, frozen=True)
class AdminRestrictedAccountItem:
    account_id: str
    display_name: str
    short_id: str | None
    email_masked: str | None
    chat_access_restricted: bool
    restricted_at: datetime
    restriction_reason: str
    source_report_id: int | None
    source_report_status: str | None
    source_report_reason: str | None
    source_report_created_at: datetime | None


@dataclass(slots=True, frozen=True)
class AdminAuditEventView:
    id: str
    event_type: str
    account_id: str | None
    account_display_name: str | None
    account_short_id: str | None
    account_email_masked: str | None
    chat_session_id: str | None
    payload: dict
    created_at: datetime


@dataclass(slots=True, frozen=True)
class AccountRestrictionResult:
    account_id: str
    chat_access_restricted: bool
    active_chat_session_id: str | None
    restriction_report_id: int | None


class AdminGovernanceService:
    def __init__(
        self,
        *,
        account_repository: AccountRepository,
        admin_repository: AdminGovernanceRepository,
        audit_event_repository: AuditEventRepository,
        durable_chat_repository: DurableChatRepository,
    ) -> None:
        self._account_repository = account_repository
        self._admin_repository = admin_repository
        self._audit_event_repository = audit_event_repository
        self._durable_chat_repository = durable_chat_repository

    async def list_reports(
        self,
        *,
        status: str | None,
        reason: str | None,
        limit: int,
        offset: int,
    ) -> list[AdminReportListItem]:
        self._validate_limit(limit)
        self._validate_offset(offset)
        if status is not None and status not in {"open", "reviewed", "dismissed", "actioned"}:
            raise AppError(
                message="Report status is invalid",
                code="INVALID_REPORT_STATUS",
                status_code=422,
            )
        if reason is not None and reason not in REPORT_REASONS:
            raise AppError(
                message="Report reason is invalid",
                code="INVALID_REPORT_REASON",
                status_code=422,
            )

        rows = await self._admin_repository.list_reports(status=status, reason=reason, limit=limit, offset=offset)
        return [
            AdminReportListItem(
                id=int(row["id"]),
                created_at=row["created_at"],
                reason=str(row["reason"]),
                status=str(row["status"]),
                reporter_display_name=str(row["reporter_display_name"]),
                reporter_short_id=row.get("reporter_short_id"),
                reporter_email_masked=_mask_email(row.get("reporter_email")),
                reported_display_name=str(row["reported_display_name"]),
                reported_short_id=row.get("reported_short_id"),
                reported_email_masked=_mask_email(row.get("reported_email")),
                reported_account_chat_access_restricted=(
                    row.get("reported_account_chat_access_restricted_at") is not None
                ),
                reported_account_chat_access_restriction_report_id=row.get(
                    "reported_account_chat_access_restriction_report_id"
                ),
            )
            for row in rows
        ]

    async def list_restricted_accounts(
        self,
        *,
        limit: int,
        offset: int,
    ) -> list[AdminRestrictedAccountItem]:
        self._validate_limit(limit)
        self._validate_offset(offset)
        rows = await self._admin_repository.list_restricted_accounts(limit=limit, offset=offset)
        return [
            AdminRestrictedAccountItem(
                account_id=str(row["account_id"]),
                display_name=str(row["display_name"]),
                short_id=row.get("short_id"),
                email_masked=_mask_email(row.get("email")),
                chat_access_restricted=True,
                restricted_at=row["restricted_at"],
                restriction_reason=str(row["restriction_reason"]),
                source_report_id=row.get("source_report_id"),
                source_report_status=row.get("source_report_status"),
                source_report_reason=row.get("source_report_reason"),
                source_report_created_at=row.get("source_report_created_at"),
            )
            for row in rows
        ]

    async def get_report_detail(self, *, report_id: int) -> AdminReportDetail:
        row = await self._admin_repository.get_report_detail(report_id=report_id)
        if row is None:
            raise AppError(message="Report not found", code="REPORT_NOT_FOUND", status_code=404)
        return self._to_report_detail(row)

    async def review_report(
        self,
        *,
        reviewer_account_id: str,
        report_id: int,
        status: str,
        review_note: str,
    ) -> AdminReportDetail:
        normalized_status = status.strip()
        normalized_note = review_note.strip()
        if normalized_status not in REPORT_REVIEW_STATUSES:
            raise AppError(
                message="Report review status is invalid",
                code="INVALID_REPORT_REVIEW_STATUS",
                status_code=422,
            )
        if not normalized_note:
            raise AppError(message="Review note is required", code="REVIEW_NOTE_REQUIRED", status_code=422)

        existing = await self.get_report_detail(report_id=report_id)
        if existing.status != "open":
            raise AppError(message="Report has already been reviewed", code="REPORT_ALREADY_REVIEWED", status_code=409)

        reviewed = await self._admin_repository.review_report(
            report_id=report_id,
            reviewer_account_id=reviewer_account_id,
            status=normalized_status,
            review_note=normalized_note,
            reviewed_at=utc_now(),
        )
        if reviewed is None:
            raise AppError(message="Report not found", code="REPORT_NOT_FOUND", status_code=404)

        detail = self._to_report_detail(reviewed)
        await self._audit_event_repository.record(
            event_type="admin.report.reviewed",
            account_id=detail.reported_account_id,
            chat_session_id=detail.reported_chat_session_id,
            payload={
                "actor_account_id": reviewer_account_id,
                "report_id": detail.id,
                "previous_status": existing.status,
                "status": detail.status,
                "review_note": detail.review_note or "",
            },
        )
        return detail

    async def list_audit_events(
        self,
        *,
        event_type: str | None,
        account_id: str | None,
        chat_session_id: str | None,
        limit: int,
        offset: int,
    ) -> list[AdminAuditEventView]:
        self._validate_limit(limit)
        self._validate_offset(offset)
        rows = await self._admin_repository.list_audit_events(
            event_type=event_type.strip() if event_type else None,
            account_id=account_id.strip() if account_id else None,
            chat_session_id=chat_session_id.strip() if chat_session_id else None,
            limit=limit,
            offset=offset,
        )
        return [
            AdminAuditEventView(
                id=str(row["id"]),
                event_type=str(row["event_type"]),
                account_id=row.get("account_id"),
                account_display_name=row.get("account_display_name"),
                account_short_id=row.get("account_short_id"),
                account_email_masked=_mask_email(row.get("account_email")),
                chat_session_id=row.get("chat_session_id"),
                payload=dict(row.get("payload") or {}),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def restrict_account(
        self,
        *,
        admin_account_id: str,
        account_id: str,
        reason: str,
        source_report_id: int | None,
    ) -> AccountRestrictionResult:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise AppError(
                message="Restriction reason is required",
                code="ACCOUNT_ACTION_REASON_REQUIRED",
                status_code=422,
            )
        if source_report_id is None:
            raise AppError(
                message="Restriction source report is required",
                code="ACCOUNT_ACTION_SOURCE_REQUIRED",
                status_code=422,
            )
        source_report = await self.get_report_detail(report_id=source_report_id)
        if source_report.reported_account_id != account_id:
            raise AppError(
                message="Restriction source report does not match the target account",
                code="ACCOUNT_ACTION_SOURCE_MISMATCH",
                status_code=422,
            )

        active_chat_session_id = await self._durable_chat_repository.get_active_chat_session_id_for_account(
            account_id=account_id
        )
        try:
            account = await self._account_repository.set_chat_access_restriction(
                account_id=account_id,
                restricted_at=utc_now(),
                restriction_reason=normalized_reason,
                restriction_report_id=source_report_id,
            )
        except LookupError as error:
            raise AppError(message="Account not found", code="ACCOUNT_NOT_FOUND", status_code=404) from error
        await self._audit_event_repository.record(
            event_type="admin.account.chat_restricted",
            account_id=account.id,
            chat_session_id=active_chat_session_id,
            payload={
                "actor_account_id": admin_account_id,
                "reason": normalized_reason,
                "had_active_session": active_chat_session_id is not None,
                "source_report_id": source_report_id,
            },
        )
        return AccountRestrictionResult(
            account_id=account.id,
            chat_access_restricted=True,
            active_chat_session_id=active_chat_session_id,
            restriction_report_id=source_report_id,
        )

    async def restore_account(
        self,
        *,
        admin_account_id: str,
        account_id: str,
        reason: str,
    ) -> AccountRestrictionResult:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise AppError(
                message="Restriction reason is required",
                code="ACCOUNT_ACTION_REASON_REQUIRED",
                status_code=422,
            )

        try:
            account = await self._account_repository.set_chat_access_restriction(
                account_id=account_id,
                restricted_at=None,
                restriction_reason=None,
                restriction_report_id=None,
            )
        except LookupError as error:
            raise AppError(message="Account not found", code="ACCOUNT_NOT_FOUND", status_code=404) from error
        await self._audit_event_repository.record(
            event_type="admin.account.chat_restored",
            account_id=account.id,
            payload={
                "actor_account_id": admin_account_id,
                "reason": normalized_reason,
            },
        )
        return AccountRestrictionResult(
            account_id=account.id,
            chat_access_restricted=False,
            active_chat_session_id=None,
            restriction_report_id=None,
        )

    @staticmethod
    def _validate_limit(limit: int) -> None:
        if limit < 1 or limit > MAX_PAGE_SIZE:
            raise AppError(message="Limit must be between 1 and 50", code="INVALID_ADMIN_PAGE_SIZE", status_code=422)

    @staticmethod
    def _validate_offset(offset: int) -> None:
        if offset < 0:
            raise AppError(message="Offset must be non-negative", code="INVALID_ADMIN_OFFSET", status_code=422)

    @staticmethod
    def _to_report_detail(row: dict[str, object]) -> AdminReportDetail:
        return AdminReportDetail(
            id=int(row["id"]),
            reason=str(row["reason"]),
            details=row.get("details"),
            status=str(row["status"]),
            created_at=row["created_at"],
            reviewed_at=row.get("reviewed_at"),
            review_note=row.get("review_note"),
            chat_match_id=str(row["chat_match_id"]),
            reported_chat_session_id=str(row["reported_chat_session_id"]),
            reporter_account_id=str(row["reporter_account_id"]),
            reporter_display_name=str(row["reporter_display_name"]),
            reporter_short_id=row.get("reporter_short_id"),
            reporter_email=row.get("reporter_email"),
            reported_account_id=str(row["reported_account_id"]),
            reported_display_name=str(row["reported_display_name"]),
            reported_short_id=row.get("reported_short_id"),
            reported_email=row.get("reported_email"),
            reported_account_chat_access_restricted=row.get("reported_account_chat_access_restricted_at") is not None,
            reported_account_chat_access_restricted_at=row.get("reported_account_chat_access_restricted_at"),
            reported_account_chat_access_restriction_reason=row.get("reported_account_chat_access_restriction_reason"),
            reported_account_chat_access_restriction_report_id=row.get("reported_account_chat_access_restriction_report_id"),
            reported_account_chat_access_restriction_report_status=row.get(
                "reported_account_chat_access_restriction_report_status"
            ),
            governance_triggered_by_this_report=(
                row.get("reported_account_chat_access_restriction_report_id") == row["id"]
            ),
            reviewer_account_id=row.get("reviewer_account_id"),
            reviewer_display_name=row.get("reviewer_display_name"),
            reviewer_email=row.get("reviewer_email"),
        )


def serialize_report_list_item(item: AdminReportListItem) -> dict[str, object]:
    return asdict(item)


def serialize_report_detail(item: AdminReportDetail) -> dict[str, object]:
    return asdict(item)


def serialize_restricted_account_item(item: AdminRestrictedAccountItem) -> dict[str, object]:
    return asdict(item)


def serialize_audit_event(item: AdminAuditEventView) -> dict[str, object]:
    return asdict(item)
