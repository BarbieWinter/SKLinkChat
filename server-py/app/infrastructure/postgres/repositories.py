from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from secrets import randbelow
from uuid import uuid4

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import aliased

from app.application.auth.security import make_expiry
from app.application.platform.services import ActiveChatMatch
from app.infrastructure.postgres.models import (
    Account,
    AccountInterest,
    AuditEvent,
    AuthSession,
    ChatMatch,
    ChatMessage,
    ChatReport,
    ChatSessionRecord,
    EmailVerificationToken,
    PasswordResetToken,
    RegistrationRiskEvent,
    utc_now,
)


class AccountRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_by_email_normalized(self, email_normalized: str) -> Account | None:
        async with self._session_factory() as session:
            return await self._get_by_email_normalized(session, email_normalized)

    async def get_by_id(self, account_id: str) -> Account | None:
        async with self._session_factory() as session:
            return await self._get_by_id(session, account_id)

    async def create(
        self,
        *,
        email: str,
        email_normalized: str,
        password_hash: str,
        display_name: str,
        interests: Sequence[str],
    ) -> Account:
        for _attempt in range(20):
            async with self._session_factory() as session:
                account = Account(
                    email=email,
                    email_normalized=email_normalized,
                    password_hash=password_hash,
                    display_name=display_name,
                    short_id=_generate_short_id(),
                )
                session.add(account)
                try:
                    await session.flush()
                except IntegrityError as error:
                    await session.rollback()
                    if _is_short_id_conflict(error):
                        continue
                    raise
                for interest in interests:
                    session.add(AccountInterest(account_id=account.id, interest=interest))
                await session.commit()
                await session.refresh(account)
                return account
        raise RuntimeError("unable to allocate unique account short_id")

    async def update_profile(self, *, account_id: str, display_name: str, interests: Sequence[str]) -> Account:
        async with self._session_factory() as session:
            account = await self._get_by_id(session, account_id)
            if account is None:
                raise LookupError("account not found")

            account.display_name = display_name
            account.updated_at = utc_now()
            await session.execute(delete(AccountInterest).where(AccountInterest.account_id == account_id))
            for interest in interests:
                session.add(AccountInterest(account_id=account_id, interest=interest))
            await session.commit()
            await session.refresh(account)
            return account

    async def mark_verified(self, *, account_id: str, verified_at: datetime) -> Account:
        async with self._session_factory() as session:
            account = await self._get_by_id(session, account_id)
            if account is None:
                raise LookupError("account not found")
            account.email_verified_at = verified_at
            account.updated_at = verified_at
            await session.commit()
            await session.refresh(account)
            return account

    async def list_interests(self, account_id: str) -> list[str]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(AccountInterest.interest)
                .where(AccountInterest.account_id == account_id)
                .order_by(AccountInterest.interest.asc())
            )
            return [row[0] for row in result.all()]

    async def update_password(self, *, account_id: str, password_hash: str) -> None:
        async with self._session_factory() as session:
            account = await self._get_by_id(session, account_id)
            if account is None:
                raise LookupError("account not found")
            account.password_hash = password_hash
            account.updated_at = utc_now()
            await session.commit()

    async def set_chat_access_restriction(
        self,
        *,
        account_id: str,
        restricted_at: datetime | None,
        restriction_reason: str | None,
        restriction_report_id: int | None,
    ) -> Account:
        async with self._session_factory() as session:
            account = await self._get_by_id(session, account_id, lock=True)
            if account is None:
                raise LookupError("account not found")
            account.chat_access_restricted_at = restricted_at
            account.chat_access_restriction_reason = restriction_reason
            account.chat_access_restriction_report_id = restriction_report_id
            account.updated_at = utc_now()
            await session.commit()
            await session.refresh(account)
            return account

    async def set_admin_status(self, *, account_id: str, is_admin: bool) -> Account:
        async with self._session_factory() as session:
            account = await self._get_by_id(session, account_id, lock=True)
            if account is None:
                raise LookupError("account not found")
            account.is_admin = is_admin
            account.updated_at = utc_now()
            await session.commit()
            await session.refresh(account)
            return account

    async def _get_by_email_normalized(self, session: AsyncSession, email_normalized: str) -> Account | None:
        result = await session.execute(select(Account).where(Account.email_normalized == email_normalized))
        return result.scalar_one_or_none()

    async def _get_by_id(self, session: AsyncSession, account_id: str, *, lock: bool = False) -> Account | None:
        statement = select(Account).where(Account.id == account_id)
        if lock:
            statement = statement.with_for_update()
        result = await session.execute(statement)
        return result.scalar_one_or_none()


def _generate_short_id() -> str:
    return str(100000 + randbelow(900000))


def _is_short_id_conflict(error: IntegrityError) -> bool:
    constraint_name = getattr(getattr(getattr(error, "orig", None), "diag", None), "constraint_name", None)
    return constraint_name == "ux_accounts_short_id"


class AuthSessionRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, *, account_id: str, token_hash: str, expires_at: datetime) -> AuthSession:
        async with self._session_factory() as session:
            auth_session = AuthSession(account_id=account_id, token_hash=token_hash, expires_at=expires_at)
            session.add(auth_session)
            await session.commit()
            await session.refresh(auth_session)
            return auth_session

    async def get_active_account_id(self, token_hash: str, now: datetime) -> str | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(AuthSession.account_id).where(
                    AuthSession.token_hash == token_hash,
                    AuthSession.expires_at > now,
                )
            )
            row = result.first()
            return row[0] if row else None

    async def delete_by_token_hash(self, token_hash: str) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))
            await session.commit()

    async def delete_expired(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
            await session.commit()


class EmailVerificationTokenRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, *, account_id: str, token_hash: str, expires_at: datetime) -> EmailVerificationToken:
        async with self._session_factory() as session:
            token = EmailVerificationToken(account_id=account_id, token_hash=token_hash, expires_at=expires_at)
            session.add(token)
            await session.commit()
            await session.refresh(token)
            return token

    async def get_by_token_hash(self, token_hash: str) -> EmailVerificationToken | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash)
            )
            return result.scalar_one_or_none()

    async def consume(self, *, token_id: str, consumed_at: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(EmailVerificationToken)
                .where(EmailVerificationToken.id == token_id)
                .values(consumed_at=consumed_at)
            )
            await session.commit()

    async def latest_created_at(self, account_id: str) -> datetime | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(EmailVerificationToken.created_at)
                .where(EmailVerificationToken.account_id == account_id)
                .order_by(EmailVerificationToken.created_at.desc())
                .limit(1)
            )
            row = result.first()
            return row[0] if row else None

    async def sent_count_since(self, account_id: str, since: datetime) -> int:
        async with self._session_factory() as session:
            result = await session.execute(
                select(func.count(EmailVerificationToken.id)).where(
                    EmailVerificationToken.account_id == account_id,
                    EmailVerificationToken.created_at >= since,
                )
            )
            return int(result.scalar_one())

    async def delete_expired_unconsumed(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(
                delete(EmailVerificationToken).where(
                    EmailVerificationToken.expires_at <= now,
                    EmailVerificationToken.consumed_at.is_(None),
                )
            )
            await session.commit()

    async def revoke_active_for_account(self, *, account_id: str, revoked_at: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(EmailVerificationToken)
                .where(
                    EmailVerificationToken.account_id == account_id,
                    EmailVerificationToken.consumed_at.is_(None),
                    EmailVerificationToken.revoked_at.is_(None),
                )
                .values(revoked_at=revoked_at)
            )
            await session.commit()


class PasswordResetTokenRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, *, account_id: str, token_hash: str, expires_at: datetime) -> PasswordResetToken:
        async with self._session_factory() as session:
            token = PasswordResetToken(account_id=account_id, token_hash=token_hash, expires_at=expires_at)
            session.add(token)
            await session.commit()
            await session.refresh(token)
            return token

    async def get_by_token_hash(self, token_hash: str) -> PasswordResetToken | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
            )
            return result.scalar_one_or_none()

    async def consume(self, *, token_id: str, consumed_at: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(PasswordResetToken)
                .where(PasswordResetToken.id == token_id)
                .values(consumed_at=consumed_at)
            )
            await session.commit()

    async def revoke_active_for_account(self, *, account_id: str, revoked_at: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(PasswordResetToken)
                .where(
                    PasswordResetToken.account_id == account_id,
                    PasswordResetToken.consumed_at.is_(None),
                    PasswordResetToken.revoked_at.is_(None),
                )
                .values(revoked_at=revoked_at)
            )
            await session.commit()

    async def latest_created_at(self, account_id: str) -> datetime | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PasswordResetToken.created_at)
                .where(PasswordResetToken.account_id == account_id)
                .order_by(PasswordResetToken.created_at.desc())
                .limit(1)
            )
            row = result.first()
            return row[0] if row else None

    async def sent_count_since(self, account_id: str, since: datetime) -> int:
        async with self._session_factory() as session:
            result = await session.execute(
                select(func.count(PasswordResetToken.id)).where(
                    PasswordResetToken.account_id == account_id,
                    PasswordResetToken.created_at >= since,
                )
            )
            return int(result.scalar_one())

    async def delete_expired(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at <= now))
            await session.commit()


class RiskEventRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], *, retention_seconds: int) -> None:
        self._session_factory = session_factory
        self._retention_seconds = retention_seconds

    async def record(
        self,
        *,
        email_normalized: str,
        outcome: str,
        details: Mapping[str, object],
        account_id: str | None,
        ip_hash: str | None,
        user_agent: str | None,
    ) -> None:
        async with self._session_factory() as session:
            session.add(
                RegistrationRiskEvent(
                    account_id=account_id,
                    email_normalized=email_normalized,
                    ip_hash=ip_hash,
                    user_agent=user_agent,
                    outcome=outcome,
                    details=dict(details),
                    expires_at=make_expiry(self._retention_seconds),
                )
            )
            await session.commit()

    async def delete_expired(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(RegistrationRiskEvent).where(RegistrationRiskEvent.expires_at <= now))
            await session.commit()


class DurableChatRepositoryImpl:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        *,
        chat_message_ttl_seconds: int,
    ) -> None:
        self._session_factory = session_factory
        self._chat_message_ttl_seconds = chat_message_ttl_seconds

    async def create_or_reuse_active_chat_session(self, *, account_id: str, display_name_snapshot: str) -> str:
        try:
            return await self._create_or_reuse_active_chat_session_once(
                account_id=account_id,
                display_name_snapshot=display_name_snapshot,
            )
        except IntegrityError:
            return await self._create_or_reuse_active_chat_session_once(
                account_id=account_id,
                display_name_snapshot=display_name_snapshot,
            )

    async def _create_or_reuse_active_chat_session_once(self, *, account_id: str, display_name_snapshot: str) -> str:
        async with self._session_factory() as session:
            record = await self._get_active_chat_session_for_account(session, account_id=account_id, lock=True)
            if record is not None:
                record.display_name_snapshot = display_name_snapshot
                record.last_seen_at = utc_now()
                await session.commit()
                return record.id

            session_id = str(uuid4())
            session.add(
                ChatSessionRecord(
                    id=session_id,
                    account_id=account_id,
                    display_name_snapshot=display_name_snapshot,
                    status="active",
                    last_seen_at=utc_now(),
                )
            )
            await session.commit()
            return session_id

    async def get_account_id_for_chat_session(self, chat_session_id: str) -> str | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.account_id).where(ChatSessionRecord.id == chat_session_id)
            )
            row = result.first()
            return row[0] if row else None

    async def touch_chat_session(
        self,
        *,
        account_id: str,
        chat_session_id: str,
        display_name_snapshot: str,
    ) -> bool:
        async with self._session_factory() as session:
            record = await session.get(ChatSessionRecord, chat_session_id)
            if record is None or record.account_id != account_id or record.status != "active":
                return False
            record.display_name_snapshot = display_name_snapshot
            record.last_seen_at = utc_now()
            await session.commit()
            return True

    async def owns_chat_session(self, *, account_id: str, chat_session_id: str) -> bool:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.id).where(
                    ChatSessionRecord.id == chat_session_id,
                    ChatSessionRecord.account_id == account_id,
                    ChatSessionRecord.status == "active",
                )
            )
            return result.first() is not None

    async def is_verified_chat_session(self, chat_session_id: str) -> bool:
        async with self._session_factory() as session:
            result = await session.execute(
                select(Account.email_verified_at)
                .join(ChatSessionRecord, ChatSessionRecord.account_id == Account.id)
                .where(
                    ChatSessionRecord.id == chat_session_id,
                    ChatSessionRecord.status == "active",
                    Account.chat_access_restricted_at.is_(None),
                )
            )
            row = result.first()
            return bool(row and row[0] is not None)

    async def get_active_chat_session_id_for_account(self, *, account_id: str) -> str | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.id)
                .where(
                    ChatSessionRecord.account_id == account_id,
                    ChatSessionRecord.status == "active",
                )
                .order_by(ChatSessionRecord.last_seen_at.desc(), ChatSessionRecord.created_at.desc())
                .limit(1)
            )
            row = result.first()
            return row[0] if row else None

    async def close_chat_session(self, *, chat_session_id: str, close_reason: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(ChatSessionRecord)
                .where(ChatSessionRecord.id == chat_session_id, ChatSessionRecord.status == "active")
                .values(
                    status="closed",
                    closed_at=utc_now(),
                    close_reason=close_reason,
                    last_seen_at=utc_now(),
                )
            )
            await session.commit()

    async def expire_chat_session(self, *, chat_session_id: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(ChatSessionRecord)
                .where(ChatSessionRecord.id == chat_session_id, ChatSessionRecord.status == "active")
                .values(
                    status="expired",
                    closed_at=utc_now(),
                    close_reason="expired",
                    last_seen_at=utc_now(),
                )
            )
            await session.commit()

    async def create_match(self, *, left_chat_session_id: str, right_chat_session_id: str) -> ActiveChatMatch:
        async with self._session_factory() as session:
            ordered_session_ids = sorted({left_chat_session_id, right_chat_session_id})
            await session.execute(
                select(ChatSessionRecord.id)
                .where(ChatSessionRecord.id.in_(ordered_session_ids))
                .order_by(ChatSessionRecord.id.asc())
                .with_for_update()
            )
            await self._end_active_matches_for_sessions(
                session,
                session_ids=(left_chat_session_id, right_chat_session_id),
                end_reason="superseded",
            )

            match = ChatMatch(
                left_chat_session_id=left_chat_session_id,
                right_chat_session_id=right_chat_session_id,
            )
            session.add(match)
            await session.commit()
            return ActiveChatMatch(
                id=match.id,
                left_chat_session_id=match.left_chat_session_id,
                right_chat_session_id=match.right_chat_session_id,
            )

    async def end_active_match_for_session(self, *, chat_session_id: str, end_reason: str) -> None:
        async with self._session_factory() as session:
            await self._end_active_matches_for_sessions(session, session_ids=(chat_session_id,), end_reason=end_reason)
            await session.commit()

    async def get_active_match(self, *, chat_session_id: str, partner_session_id: str) -> ActiveChatMatch | None:
        async with self._session_factory() as session:
            match = await self._find_active_match(
                session,
                left_chat_session_id=chat_session_id,
                right_chat_session_id=partner_session_id,
            )
            if match is None:
                return None
            return ActiveChatMatch(
                id=match.id,
                left_chat_session_id=match.left_chat_session_id,
                right_chat_session_id=match.right_chat_session_id,
            )

    async def get_active_match_for_account(
        self,
        *,
        account_id: str,
        partner_session_id: str,
    ) -> ActiveChatMatch | None:
        async with self._session_factory() as session:
            left_session = aliased(ChatSessionRecord)
            right_session = aliased(ChatSessionRecord)
            result = await session.execute(
                select(ChatMatch)
                .join(left_session, ChatMatch.left_chat_session_id == left_session.id)
                .join(right_session, ChatMatch.right_chat_session_id == right_session.id)
                .where(
                    ChatMatch.ended_at.is_(None),
                    or_(
                        and_(
                            left_session.account_id == account_id,
                            left_session.status == "active",
                            right_session.id == partner_session_id,
                            right_session.status == "active",
                        ),
                        and_(
                            right_session.account_id == account_id,
                            right_session.status == "active",
                            left_session.id == partner_session_id,
                            left_session.status == "active",
                        ),
                    ),
                )
                .limit(1)
            )
            match = result.scalar_one_or_none()
            if match is None:
                return None
            return ActiveChatMatch(
                id=match.id,
                left_chat_session_id=match.left_chat_session_id,
                right_chat_session_id=match.right_chat_session_id,
            )

    async def append_message(
        self,
        *,
        sender_chat_session_id: str,
        recipient_chat_session_id: str,
        sender_display_name_snapshot: str,
        body: str,
        client_message_id: str | None = None,
        message_type: str = "text",
    ) -> bool:
        async with self._session_factory() as session:
            match = await self._find_active_match(
                session,
                left_chat_session_id=sender_chat_session_id,
                right_chat_session_id=recipient_chat_session_id,
            )
            if match is None:
                return False
            session.add(
                ChatMessage(
                    chat_match_id=match.id,
                    sender_chat_session_id=sender_chat_session_id,
                    client_message_id=client_message_id,
                    message_type=message_type,
                    sender_display_name_snapshot=sender_display_name_snapshot,
                    body=body,
                    expires_at=make_expiry(self._chat_message_ttl_seconds),
                )
            )
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                if client_message_id is not None:
                    return False
                raise
            return True

    async def create_report(
        self,
        *,
        reporter_account_id: str,
        chat_match_id: str,
        reported_chat_session_id: str,
        reason: str,
        details: str | None,
    ) -> int:
        async with self._session_factory() as session:
            report = ChatReport(
                reporter_account_id=reporter_account_id,
                chat_match_id=chat_match_id,
                reported_chat_session_id=reported_chat_session_id,
                reason=reason,
                details=details,
            )
            session.add(report)
            await session.commit()
            await session.refresh(report)
            return report.id

    async def purge_expired_messages(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(ChatMessage).where(ChatMessage.expires_at <= now))
            await session.commit()

    async def _get_active_chat_session_for_account(
        self,
        session: AsyncSession,
        *,
        account_id: str,
        lock: bool,
    ) -> ChatSessionRecord | None:
        statement = (
            select(ChatSessionRecord)
            .where(
                ChatSessionRecord.account_id == account_id,
                ChatSessionRecord.status == "active",
            )
            .order_by(ChatSessionRecord.last_seen_at.desc(), ChatSessionRecord.created_at.desc())
            .limit(1)
        )
        if lock:
            statement = statement.with_for_update()
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _find_active_match(
        self,
        session: AsyncSession,
        *,
        left_chat_session_id: str,
        right_chat_session_id: str,
    ) -> ChatMatch | None:
        result = await session.execute(
            select(ChatMatch)
            .where(
                ChatMatch.ended_at.is_(None),
                or_(
                    and_(
                        ChatMatch.left_chat_session_id == left_chat_session_id,
                        ChatMatch.right_chat_session_id == right_chat_session_id,
                    ),
                    and_(
                        ChatMatch.left_chat_session_id == right_chat_session_id,
                        ChatMatch.right_chat_session_id == left_chat_session_id,
                    ),
                ),
            )
            .order_by(ChatMatch.started_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _end_active_matches_for_sessions(
        self,
        session: AsyncSession,
        *,
        session_ids: Sequence[str],
        end_reason: str,
    ) -> None:
        unique_session_ids = tuple(dict.fromkeys(session_ids))
        if not unique_session_ids:
            return
        await session.execute(
            update(ChatMatch)
            .where(
                ChatMatch.ended_at.is_(None),
                or_(
                    ChatMatch.left_chat_session_id.in_(unique_session_ids),
                    ChatMatch.right_chat_session_id.in_(unique_session_ids),
                ),
            )
            .values(
                ended_at=utc_now(),
                end_reason=end_reason,
            )
        )


class AuditEventRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], *, retention_seconds: int) -> None:
        self._session_factory = session_factory
        self._retention_seconds = retention_seconds

    async def record(
        self,
        *,
        event_type: str,
        payload: Mapping[str, object],
        account_id: str | None = None,
        chat_session_id: str | None = None,
    ) -> None:
        async with self._session_factory() as session:
            session.add(
                AuditEvent(
                    account_id=account_id,
                    chat_session_id=chat_session_id,
                    event_type=event_type,
                    payload=dict(payload),
                    expires_at=make_expiry(self._retention_seconds),
                )
            )
            await session.commit()

    async def delete_expired(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(AuditEvent).where(AuditEvent.expires_at <= now))
            await session.commit()


class AdminGovernanceRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def list_reports(
        self,
        *,
        status: str | None,
        reason: str | None,
        limit: int,
        offset: int,
    ) -> list[dict[str, object]]:
        reporter_account = aliased(Account)
        reported_account = aliased(Account)
        reported_session = aliased(ChatSessionRecord)

        async with self._session_factory() as session:
            statement = (
                select(
                    ChatReport.id.label("id"),
                    ChatReport.created_at.label("created_at"),
                    ChatReport.reason.label("reason"),
                    ChatReport.status.label("status"),
                    reporter_account.display_name.label("reporter_display_name"),
                    reporter_account.short_id.label("reporter_short_id"),
                    reporter_account.email.label("reporter_email"),
                    reported_account.display_name.label("reported_display_name"),
                    reported_account.short_id.label("reported_short_id"),
                    reported_account.email.label("reported_email"),
                    reported_account.chat_access_restricted_at.label("reported_account_chat_access_restricted_at"),
                    reported_account.chat_access_restriction_report_id.label(
                        "reported_account_chat_access_restriction_report_id"
                    ),
                )
                .join(reporter_account, reporter_account.id == ChatReport.reporter_account_id)
                .join(reported_session, reported_session.id == ChatReport.reported_chat_session_id)
                .join(reported_account, reported_account.id == reported_session.account_id)
            )
            if status:
                statement = statement.where(ChatReport.status == status)
            if reason:
                statement = statement.where(ChatReport.reason == reason)
            result = await session.execute(
                statement.order_by(ChatReport.created_at.desc(), ChatReport.id.desc()).limit(limit).offset(offset)
            )
            return [dict(row._mapping) for row in result]

    async def list_restricted_accounts(
        self,
        *,
        limit: int,
        offset: int,
    ) -> list[dict[str, object]]:
        source_report = aliased(ChatReport)

        async with self._session_factory() as session:
            result = await session.execute(
                select(
                    Account.id.label("account_id"),
                    Account.display_name.label("display_name"),
                    Account.short_id.label("short_id"),
                    Account.email.label("email"),
                    Account.chat_access_restricted_at.label("restricted_at"),
                    Account.chat_access_restriction_reason.label("restriction_reason"),
                    Account.chat_access_restriction_report_id.label("source_report_id"),
                    source_report.status.label("source_report_status"),
                    source_report.reason.label("source_report_reason"),
                    source_report.created_at.label("source_report_created_at"),
                )
                .select_from(Account)
                .outerjoin(source_report, source_report.id == Account.chat_access_restriction_report_id)
                .where(Account.chat_access_restricted_at.is_not(None))
                .order_by(Account.chat_access_restricted_at.desc(), Account.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return [dict(row._mapping) for row in result]

    async def get_report_detail(self, *, report_id: int) -> dict[str, object] | None:
        async with self._session_factory() as session:
            return await self._load_report_detail(session, report_id=report_id)

    async def review_report(
        self,
        *,
        report_id: int,
        reviewer_account_id: str,
        status: str,
        review_note: str,
        reviewed_at: datetime,
    ) -> dict[str, object] | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatReport).where(ChatReport.id == report_id).with_for_update()
            )
            report = result.scalar_one_or_none()
            if report is None:
                return None

            report.status = status
            report.reviewed_at = reviewed_at
            report.reviewed_by_account_id = reviewer_account_id
            report.review_note = review_note
            await session.commit()
            return await self._load_report_detail(session, report_id=report_id)

    async def list_audit_events(
        self,
        *,
        event_type: str | None,
        account_id: str | None,
        chat_session_id: str | None,
        limit: int,
        offset: int,
    ) -> list[dict[str, object]]:
        account = aliased(Account)

        async with self._session_factory() as session:
            statement = (
                select(
                    AuditEvent.id.label("id"),
                    AuditEvent.event_type.label("event_type"),
                    AuditEvent.account_id.label("account_id"),
                    AuditEvent.chat_session_id.label("chat_session_id"),
                    AuditEvent.payload.label("payload"),
                    AuditEvent.created_at.label("created_at"),
                    account.display_name.label("account_display_name"),
                    account.short_id.label("account_short_id"),
                    account.email.label("account_email"),
                )
                .select_from(AuditEvent)
                .outerjoin(account, account.id == AuditEvent.account_id)
            )
            if event_type:
                statement = statement.where(AuditEvent.event_type == event_type)
            if account_id:
                statement = statement.where(AuditEvent.account_id == account_id)
            if chat_session_id:
                statement = statement.where(AuditEvent.chat_session_id == chat_session_id)
            result = await session.execute(
                statement.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)
            )
            return [dict(row._mapping) for row in result]

    async def _load_report_detail(self, session: AsyncSession, *, report_id: int) -> dict[str, object] | None:
        reporter_account = aliased(Account)
        reported_account = aliased(Account)
        reported_session = aliased(ChatSessionRecord)
        reviewer_account = aliased(Account)
        source_report = aliased(ChatReport)

        result = await session.execute(
            select(
                ChatReport.id.label("id"),
                ChatReport.reason.label("reason"),
                ChatReport.details.label("details"),
                ChatReport.status.label("status"),
                ChatReport.created_at.label("created_at"),
                ChatReport.reviewed_at.label("reviewed_at"),
                ChatReport.review_note.label("review_note"),
                ChatReport.chat_match_id.label("chat_match_id"),
                ChatReport.reported_chat_session_id.label("reported_chat_session_id"),
                reporter_account.id.label("reporter_account_id"),
                reporter_account.display_name.label("reporter_display_name"),
                reporter_account.short_id.label("reporter_short_id"),
                reporter_account.email.label("reporter_email"),
                reported_account.id.label("reported_account_id"),
                reported_account.display_name.label("reported_display_name"),
                reported_account.short_id.label("reported_short_id"),
                reported_account.email.label("reported_email"),
                reported_account.chat_access_restricted_at.label("reported_account_chat_access_restricted_at"),
                reported_account.chat_access_restriction_reason.label("reported_account_chat_access_restriction_reason"),
                reported_account.chat_access_restriction_report_id.label(
                    "reported_account_chat_access_restriction_report_id"
                ),
                source_report.status.label("reported_account_chat_access_restriction_report_status"),
                reviewer_account.id.label("reviewer_account_id"),
                reviewer_account.display_name.label("reviewer_display_name"),
                reviewer_account.email.label("reviewer_email"),
            )
            .select_from(ChatReport)
            .join(reporter_account, reporter_account.id == ChatReport.reporter_account_id)
            .join(reported_session, reported_session.id == ChatReport.reported_chat_session_id)
            .join(reported_account, reported_account.id == reported_session.account_id)
            .outerjoin(source_report, source_report.id == reported_account.chat_access_restriction_report_id)
            .outerjoin(reviewer_account, reviewer_account.id == ChatReport.reviewed_by_account_id)
            .where(ChatReport.id == report_id)
        )
        row = result.first()
        return dict(row._mapping) if row else None
