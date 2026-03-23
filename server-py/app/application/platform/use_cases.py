from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from app.application.platform.ports import PresenceRepository, ReadinessProbe
from app.shared.errors import AppError


@dataclass(slots=True)
class CreateAnonymousSessionUseCase:
    def execute(self) -> dict[str, str]:
        return {"session_id": str(uuid4())}


@dataclass(slots=True)
class ReadinessCheckUseCase:
    readiness_probe: ReadinessProbe

    async def execute(self) -> dict[str, str]:
        try:
            await self.readiness_probe.ping()
        except Exception as error:
            raise AppError(message="redis is unavailable", code="REDIS_UNAVAILABLE", status_code=503) from error
        return {"status": "ready"}


@dataclass(slots=True)
class OnlineUserCountUseCase:
    presence_repository: PresenceRepository

    async def execute(self) -> dict[str, int]:
        return {"online_count": await self.presence_repository.online_count()}
