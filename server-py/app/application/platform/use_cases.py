from __future__ import annotations

from dataclasses import dataclass

from app.application.account.service import AccountProfileView, AccountService
from app.application.auth.service import AuthService, AuthSessionView
from app.application.chat.access_service import AuthorizedChatSession, ChatAccessService
from app.application.platform.ports import PresenceRepository, ReadinessProbe
from app.shared.errors import AppError


@dataclass(slots=True)
class CreateChatSessionUseCase:
    service: ChatAccessService

    async def execute(self, account_id: str) -> dict[str, str]:
        return {"session_id": await self.service.create_chat_session(account_id)}


@dataclass(slots=True)
class ResolveAuthSessionUseCase:
    auth_service: AuthService

    async def execute(self, raw_session_token: str | None) -> tuple[str | None, AuthSessionView]:
        return await self.auth_service.get_session_view(raw_session_token=raw_session_token)


@dataclass(slots=True)
class AuthorizeChatSessionUseCase:
    service: ChatAccessService

    async def execute(self, *, account_id: str, session_id: str) -> AuthorizedChatSession:
        return await self.service.authorize_chat_session(account_id=account_id, session_id=session_id)


@dataclass(slots=True)
class GetAccountProfileUseCase:
    service: AccountService

    async def execute(self, account_id: str) -> AccountProfileView:
        return await self.service.get_profile(account_id)


@dataclass(slots=True)
class UpdateAccountProfileUseCase:
    service: AccountService

    async def execute(self, *, account_id: str, display_name: str, interests: list[str]) -> AccountProfileView:
        return await self.service.update_profile(
            account_id=account_id,
            display_name=display_name,
            interests=interests,
        )


@dataclass(slots=True)
class ReadinessCheckUseCase:
    readiness_probe: ReadinessProbe

    async def execute(self) -> dict[str, str]:
        try:
            await self.readiness_probe.ping()
        except Exception as error:
            raise AppError(
                message="dependencies are unavailable",
                code="DEPENDENCY_UNAVAILABLE",
                status_code=503,
            ) from error
        return {"status": "ready"}


@dataclass(slots=True)
class OnlineUserCountUseCase:
    presence_repository: PresenceRepository

    async def execute(self) -> dict[str, int]:
        return {"online_count": await self.presence_repository.online_count()}
