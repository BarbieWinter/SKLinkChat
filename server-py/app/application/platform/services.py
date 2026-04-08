from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True, frozen=True)
class ActiveChatMatch:
    id: str
    left_chat_session_id: str
    right_chat_session_id: str


class DurableChatRepository(Protocol):
    async def create_or_reuse_active_chat_session(self, *, account_id: str, display_name_snapshot: str) -> str: ...

    async def get_account_id_for_chat_session(self, chat_session_id: str) -> str | None: ...

    async def touch_chat_session(
        self,
        *,
        account_id: str,
        chat_session_id: str,
        display_name_snapshot: str,
    ) -> bool: ...

    async def owns_chat_session(self, *, account_id: str, chat_session_id: str) -> bool: ...

    async def is_verified_chat_session(self, chat_session_id: str) -> bool: ...

    async def get_active_chat_session_id_for_account(self, *, account_id: str) -> str | None: ...

    async def close_chat_session(self, *, chat_session_id: str, close_reason: str) -> None: ...

    async def expire_chat_session(self, *, chat_session_id: str) -> None: ...

    async def create_match(self, *, left_chat_session_id: str, right_chat_session_id: str) -> ActiveChatMatch: ...

    async def end_active_match_for_session(self, *, chat_session_id: str, end_reason: str) -> None: ...

    async def get_active_match(self, *, chat_session_id: str, partner_session_id: str) -> ActiveChatMatch | None: ...

    async def get_active_match_for_account(
        self,
        *,
        account_id: str,
        partner_session_id: str,
    ) -> ActiveChatMatch | None: ...

    async def append_message(
        self,
        *,
        sender_chat_session_id: str,
        recipient_chat_session_id: str,
        sender_display_name_snapshot: str,
        body: str,
        client_message_id: str | None = None,
        message_type: str = "text",
    ) -> bool: ...

    async def create_report(
        self,
        *,
        reporter_account_id: str,
        chat_match_id: str,
        reported_chat_session_id: str,
        reason: str,
        details: str | None,
    ) -> int: ...
