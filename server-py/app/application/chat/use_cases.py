from __future__ import annotations

from dataclasses import dataclass

from starlette.websockets import WebSocket

from app.application.chat.runtime_service import ChatRuntimeService
from app.domain.chat.models import ChatSession, MatchResult


@dataclass(slots=True)
class BootstrapConnectionUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str, websocket: WebSocket, *, display_name: str | None = None) -> ChatSession:
        await self.runtime.register_connection(session_id, websocket)
        return await self.runtime.get_or_create_session(session_id, name=display_name)


@dataclass(slots=True)
class UpdateProfileUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str, *, name: str | None) -> ChatSession:
        return await self.runtime.update_user_info(session_id, name=name)


@dataclass(slots=True)
class EnterQueueUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str) -> ChatSession:
        return await self.runtime.enter_queue(session_id)


@dataclass(slots=True)
class TryMatchUseCase:
    runtime: ChatRuntimeService

    async def execute(self) -> MatchResult | None:
        return await self.runtime.try_match()


@dataclass(slots=True)
class SendMessageUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str, message: str):
        return await self.runtime.record_message(session_id, message)


@dataclass(slots=True)
class SetTypingUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str, *, is_typing: bool) -> str | None:
        return await self.runtime.set_typing(session_id, is_typing=is_typing)


@dataclass(slots=True)
class DisconnectSessionUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str) -> str | None:
        return await self.runtime.disconnect_partner(session_id)


@dataclass(slots=True)
class LookupPartnerUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str):
        return await self.runtime.lookup_current_partner(session_id)


@dataclass(slots=True)
class MarkDisconnectedUseCase:
    runtime: ChatRuntimeService

    async def execute(self, session_id: str, *, force: bool = False) -> None:
        await self.runtime.mark_disconnected(session_id, force=force)


@dataclass(slots=True)
class ExpireStaleSessionsUseCase:
    runtime: ChatRuntimeService

    async def execute(self) -> list[str]:
        return await self.runtime.expire_stale_sessions()
