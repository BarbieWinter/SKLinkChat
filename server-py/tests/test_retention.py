from __future__ import annotations

import asyncio
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application.retention.service import RetentionService
from app.infrastructure.postgres.database import Base
from app.infrastructure.postgres.models import (
    Account,
    AuditEvent,
    AuthSession,
    ChatMatch,
    ChatMessage,
    ChatSessionRecord,
    EmailVerificationToken,
    RegistrationRiskEvent,
    utc_now,
)
from app.infrastructure.postgres.repositories import (
    AuditEventRepository,
    AuthSessionRepository,
    DurableChatRepositoryImpl,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RiskEventRepository,
)
from tests.postgres_utils import ensure_database_exists, get_test_database_url


def _run(coro):
    return asyncio.run(coro)


def test_retention_service_purges_expired_records():
    async def scenario() -> None:
        database_url = get_test_database_url()
        ensure_database_exists(database_url)
        engine = create_async_engine(database_url, future=True)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

        auth_session_repository = AuthSessionRepository(session_factory)
        verification_token_repository = EmailVerificationTokenRepository(session_factory)
        password_reset_token_repository = PasswordResetTokenRepository(session_factory)
        durable_chat_repository = DurableChatRepositoryImpl(session_factory, chat_message_ttl_seconds=60)
        risk_event_repository = RiskEventRepository(session_factory, retention_seconds=60)
        audit_event_repository = AuditEventRepository(session_factory, retention_seconds=60)
        retention_service = RetentionService(
            auth_session_repository=auth_session_repository,
            verification_token_repository=verification_token_repository,
            password_reset_token_repository=password_reset_token_repository,
            durable_chat_repository=durable_chat_repository,
            risk_event_repository=risk_event_repository,
            audit_event_repository=audit_event_repository,
        )

        now = utc_now()
        async with session_factory() as session:
            left_account = Account(
                email="left@test.dev",
                email_normalized="left@test.dev",
                password_hash="hashed-password",
                display_name="Left",
                short_id="100001",
            )
            right_account = Account(
                email="right@test.dev",
                email_normalized="right@test.dev",
                password_hash="hashed-password",
                display_name="Right",
                short_id="100002",
            )
            session.add_all([left_account, right_account])
            await session.flush()

            left_chat_session = ChatSessionRecord(
                id="chat-session-left",
                account_id=left_account.id,
                display_name_snapshot="Left",
                status="active",
            )
            right_chat_session = ChatSessionRecord(
                id="chat-session-right",
                account_id=right_account.id,
                display_name_snapshot="Right",
                status="active",
            )
            session.add_all([left_chat_session, right_chat_session])
            await session.flush()

            session.add(
                ChatMatch(
                    id="chat-match-1",
                    left_chat_session_id=left_chat_session.id,
                    right_chat_session_id=right_chat_session.id,
                )
            )
            session.add(
                AuthSession(
                    account_id=left_account.id,
                    token_hash="expired-auth-token",
                    expires_at=now - timedelta(minutes=5),
                )
            )
            session.add(
                EmailVerificationToken(
                    account_id=left_account.id,
                    token_hash="expired-verification-token",
                    expires_at=now - timedelta(minutes=5),
                )
            )
            session.add(
                ChatMessage(
                    chat_match_id="chat-match-1",
                    sender_chat_session_id=left_chat_session.id,
                    sender_display_name_snapshot="Left",
                    body="old message",
                    expires_at=now - timedelta(days=1),
                )
            )
            session.add(
                RegistrationRiskEvent(
                    account_id=left_account.id,
                    email_normalized="left@test.dev",
                    outcome="registered",
                    details={},
                    expires_at=now - timedelta(days=1),
                )
            )
            session.add(
                AuditEvent(
                    account_id=left_account.id,
                    chat_session_id=left_chat_session.id,
                    event_type="chat.message.sent",
                    payload={},
                    expires_at=now - timedelta(days=1),
                )
            )
            await session.commit()

        await retention_service.run_once()

        async with session_factory() as session:
            assert await session.scalar(select(AuthSession.id)) is None
            assert await session.scalar(select(EmailVerificationToken.id)) is None
            assert await session.scalar(select(ChatMessage.id)) is None
            assert await session.scalar(select(RegistrationRiskEvent.id)) is None
            assert await session.scalar(select(AuditEvent.id)) is None

        await engine.dispose()

    _run(scenario())
