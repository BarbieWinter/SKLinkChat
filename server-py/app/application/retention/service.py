from __future__ import annotations

from dataclasses import dataclass

from app.application.auth.security import utc_now
from app.infrastructure.postgres.repositories import (
    AuditEventRepository,
    AuthSessionRepository,
    DurableChatRepositoryImpl,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RiskEventRepository,
)


@dataclass(slots=True)
class RetentionService:
    auth_session_repository: AuthSessionRepository
    verification_token_repository: EmailVerificationTokenRepository
    password_reset_token_repository: PasswordResetTokenRepository
    durable_chat_repository: DurableChatRepositoryImpl
    risk_event_repository: RiskEventRepository
    audit_event_repository: AuditEventRepository

    async def run_once(self) -> None:
        now = utc_now()
        await self.auth_session_repository.delete_expired(now)
        await self.verification_token_repository.delete_expired_unconsumed(now)
        await self.password_reset_token_repository.delete_expired(now)
        await self.durable_chat_repository.purge_expired_messages(now)
        await self.risk_event_repository.delete_expired(now)
        await self.audit_event_repository.delete_expired(now)
