from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.shared.protocol import PayloadType, UserState


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(slots=True, frozen=True)
class ChatHistoryEntry:
    payload_type: PayloadType
    from_session_id: str
    payload: str
    created_at: datetime = field(default_factory=utc_now)


@dataclass(slots=True)
class ChatSession:
    session_id: str
    name: str
    state: UserState = UserState.IDLE
    partner_id: str | None = None
    is_typing: bool = False
    reconnect_deadline: datetime | None = None
    recent_history: list[ChatHistoryEntry] = field(default_factory=list, repr=False)

    @property
    def is_reconnect_pending(self) -> bool:
        return self.reconnect_deadline is not None


@dataclass(slots=True, frozen=True)
class MatchResult:
    left: ChatSession
    right: ChatSession
