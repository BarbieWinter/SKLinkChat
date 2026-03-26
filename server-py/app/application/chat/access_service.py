from __future__ import annotations

from dataclasses import dataclass

from app.application.platform.services import DurableChatRepository
from app.infrastructure.postgres.repositories import AccountRepository
from app.shared.errors import AppError


@dataclass(slots=True, frozen=True)
class AuthorizedChatSession:
    session_id: str
    display_name: str
    short_id: str


class ChatAccessService:
    def __init__(
        self,
        *,
        account_repository: AccountRepository,
        durable_chat_repository: DurableChatRepository,
    ) -> None:
        self._account_repository = account_repository
        self._durable_chat_repository = durable_chat_repository

    async def create_chat_session(self, account_id: str) -> str:
        account = await self._require_chat_enabled_account(account_id)
        return await self._durable_chat_repository.create_or_reuse_active_chat_session(
            account_id=account_id,
            display_name_snapshot=account.display_name,
        )

    async def authorize_chat_session(self, *, account_id: str, session_id: str) -> AuthorizedChatSession:
        account = await self._require_chat_enabled_account(account_id)
        owns_session = await self._durable_chat_repository.owns_chat_session(
            account_id=account_id,
            chat_session_id=session_id,
        )
        if not owns_session:
            raise AppError(message="Chat session ownership mismatch", code="CHAT_SESSION_FORBIDDEN", status_code=403)
        was_touched = await self._durable_chat_repository.touch_chat_session(
            account_id=account_id,
            chat_session_id=session_id,
            display_name_snapshot=account.display_name,
        )
        if not was_touched:
            raise AppError(message="Chat session ownership mismatch", code="CHAT_SESSION_FORBIDDEN", status_code=403)
        return AuthorizedChatSession(
            session_id=session_id,
            display_name=account.display_name,
            short_id=account.short_id,
        )

    async def require_chat_enabled_account(self, account_id: str) -> str:
        account = await self._require_chat_enabled_account(account_id)
        return account.display_name

    async def _require_chat_enabled_account(self, account_id: str):
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        if account.email_verified_at is None:
            raise AppError(message="Email verification is required", code="EMAIL_NOT_VERIFIED", status_code=403)
        if account.chat_access_restricted_at is not None:
            raise AppError(message="Chat access is restricted", code="CHAT_ACCESS_RESTRICTED", status_code=403)
        return account
