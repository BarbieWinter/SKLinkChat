from __future__ import annotations

from app.application.platform.services import DurableChatRepository


class VerifiedChatPermissionGate:
    def __init__(self, durable_chat_repository: DurableChatRepository) -> None:
        self._durable_chat_repository = durable_chat_repository

    async def allow_anonymous_chat(self, session_id: str) -> bool:
        return await self._durable_chat_repository.is_verified_chat_session(session_id)
