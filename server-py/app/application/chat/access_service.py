from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import uuid4

from app.application.platform.services import DurableChatRepository
from app.infrastructure.postgres.repositories import AccountRepository
from app.shared.errors import AppError


@dataclass(slots=True, frozen=True)
class AuthorizedChatSession:
    session_id: str
    display_name: str


class ChatAccessService:
    def __init__(
        self,
        *,
        account_repository: AccountRepository,
        durable_chat_repository: DurableChatRepository,
    ) -> None:
        self._account_repository = account_repository
        self._durable_chat_repository = durable_chat_repository
        self._creation_lock = asyncio.Lock()

    async def create_chat_session(self, account_id: str) -> str:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        if account.email_verified_at is None:
            raise AppError(message="Email verification is required", code="EMAIL_NOT_VERIFIED", status_code=403)
        async with self._creation_lock:
            session_id = await self._durable_chat_repository.get_latest_chat_session_id_for_account(account_id)
            if session_id is None:
                session_id = str(uuid4())
            await self._durable_chat_repository.touch_chat_session(account_id=account_id, chat_session_id=session_id)
            return session_id

    async def authorize_chat_session(self, *, account_id: str, session_id: str) -> AuthorizedChatSession:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        if account.email_verified_at is None:
            raise AppError(message="Email verification is required", code="EMAIL_NOT_VERIFIED", status_code=403)
        owns_session = await self._durable_chat_repository.owns_chat_session(
            account_id=account_id,
            chat_session_id=session_id,
        )
        if not owns_session:
            raise AppError(message="Chat session ownership mismatch", code="CHAT_SESSION_FORBIDDEN", status_code=403)
        await self._durable_chat_repository.touch_chat_session(account_id=account_id, chat_session_id=session_id)
        return AuthorizedChatSession(session_id=session_id, display_name=account.display_name)
