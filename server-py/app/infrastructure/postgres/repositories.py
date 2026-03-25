from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.auth.security import make_expiry
from app.infrastructure.postgres.models import (
    Account,
    AccountInterest,
    AuditEvent,
    AuthSession,
    ChatMatch,
    ChatMessage,
    ChatSessionRecord,
    EmailVerificationToken,
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
        async with self._session_factory() as session:
            account = Account(
                email=email,
                email_normalized=email_normalized,
                password_hash=password_hash,
                display_name=display_name,
            )
            session.add(account)
            await session.flush()
            for interest in interests:
                session.add(AccountInterest(account_id=account.id, interest=interest))
            await session.commit()
            await session.refresh(account)
            return account

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

    async def _get_by_email_normalized(self, session: AsyncSession, email_normalized: str) -> Account | None:
        result = await session.execute(select(Account).where(Account.email_normalized == email_normalized))
        return result.scalar_one_or_none()

    async def _get_by_id(self, session: AsyncSession, account_id: str) -> Account | None:
        result = await session.execute(select(Account).where(Account.id == account_id))
        return result.scalar_one_or_none()


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

    async def get_latest_chat_session_id_for_account(self, account_id: str) -> str | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.id)
                .where(ChatSessionRecord.account_id == account_id)
                .order_by(ChatSessionRecord.last_seen_at.desc(), ChatSessionRecord.created_at.desc())
                .limit(1)
            )
            row = result.first()
            return row[0] if row else None

    async def get_account_id_for_chat_session(self, chat_session_id: str) -> str | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.account_id).where(ChatSessionRecord.id == chat_session_id)
            )
            row = result.first()
            return row[0] if row else None

    async def touch_chat_session(self, *, account_id: str, chat_session_id: str) -> None:
        async with self._session_factory() as session:
            record = await session.get(ChatSessionRecord, chat_session_id)
            if record is None:
                session.add(ChatSessionRecord(id=chat_session_id, account_id=account_id, last_seen_at=utc_now()))
            else:
                record.account_id = account_id
                record.last_seen_at = utc_now()
                record.closed_at = None
            await session.commit()

    async def owns_chat_session(self, *, account_id: str, chat_session_id: str) -> bool:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatSessionRecord.id).where(
                    ChatSessionRecord.id == chat_session_id,
                    ChatSessionRecord.account_id == account_id,
                )
            )
            return result.first() is not None

    async def is_verified_chat_session(self, chat_session_id: str) -> bool:
        async with self._session_factory() as session:
            result = await session.execute(
                select(Account.email_verified_at)
                .join(ChatSessionRecord, ChatSessionRecord.account_id == Account.id)
                .where(ChatSessionRecord.id == chat_session_id)
            )
            row = result.first()
            return bool(row and row[0] is not None)

    async def create_match(self, *, left_chat_session_id: str, right_chat_session_id: str) -> None:
        async with self._session_factory() as session:
            await self._end_active_matches_for_pair(session, left_chat_session_id, right_chat_session_id)
            session.add(
                ChatMatch(
                    left_chat_session_id=left_chat_session_id,
                    right_chat_session_id=right_chat_session_id,
                )
            )
            await session.commit()

    async def end_active_match_for_session(self, chat_session_id: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(ChatMatch)
                .where(
                    ChatMatch.ended_at.is_(None),
                    or_(
                        ChatMatch.left_chat_session_id == chat_session_id,
                        ChatMatch.right_chat_session_id == chat_session_id,
                    ),
                )
                .values(ended_at=utc_now())
            )
            await session.execute(
                update(ChatSessionRecord).where(ChatSessionRecord.id == chat_session_id).values(closed_at=utc_now())
            )
            await session.commit()

    async def append_message(
        self,
        *,
        sender_chat_session_id: str,
        recipient_chat_session_id: str,
        content: str,
    ) -> None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ChatMatch)
                .where(
                    ChatMatch.ended_at.is_(None),
                    or_(
                        and_(
                            ChatMatch.left_chat_session_id == sender_chat_session_id,
                            ChatMatch.right_chat_session_id == recipient_chat_session_id,
                        ),
                        and_(
                            ChatMatch.left_chat_session_id == recipient_chat_session_id,
                            ChatMatch.right_chat_session_id == sender_chat_session_id,
                        ),
                    ),
                )
                .order_by(ChatMatch.started_at.desc())
                .limit(1)
            )
            match = result.scalar_one_or_none()
            if match is None:
                return
            session.add(
                ChatMessage(
                    match_id=match.id,
                    sender_chat_session_id=sender_chat_session_id,
                    content=content,
                    expires_at=make_expiry(self._chat_message_ttl_seconds),
                )
            )
            await session.commit()

    async def purge_expired_messages(self, now: datetime) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(ChatMessage).where(ChatMessage.expires_at <= now))
            await session.commit()

    async def _end_active_matches_for_pair(
        self,
        session: AsyncSession,
        left_chat_session_id: str,
        right_chat_session_id: str,
    ) -> None:
        await session.execute(
            update(ChatMatch)
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
            .values(ended_at=utc_now())
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
