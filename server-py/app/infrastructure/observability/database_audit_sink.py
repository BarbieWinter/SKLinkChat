from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.infrastructure.postgres.repositories import AuditEventRepository


class DatabaseAuditSink:
    def __init__(self, audit_event_repository: AuditEventRepository) -> None:
        self._audit_event_repository = audit_event_repository

    async def record(self, event: str, payload: Mapping[str, Any]) -> None:
        await self._audit_event_repository.record(
            event_type=event,
            payload=dict(payload),
            chat_session_id=str(payload.get("session_id")) if payload.get("session_id") else None,
        )
