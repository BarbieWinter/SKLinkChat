from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol


class EmailSender(Protocol):
    async def send_verification_email(self, *, recipient: str, display_name: str, verification_link: str) -> None: ...


@dataclass(slots=True, frozen=True)
class TurnstileVerificationResult:
    success: bool
    provider: str
    error_codes: tuple[str, ...] = ()


class TurnstileVerifier(Protocol):
    async def verify(self, token: str, *, remote_ip: str | None) -> TurnstileVerificationResult: ...


class DurableChatRepository(Protocol):
    async def get_latest_chat_session_id_for_account(self, account_id: str) -> str | None: ...

    async def get_account_id_for_chat_session(self, chat_session_id: str) -> str | None: ...

    async def touch_chat_session(self, *, account_id: str, chat_session_id: str) -> None: ...

    async def owns_chat_session(self, *, account_id: str, chat_session_id: str) -> bool: ...

    async def is_verified_chat_session(self, chat_session_id: str) -> bool: ...

    async def create_match(self, *, left_chat_session_id: str, right_chat_session_id: str) -> None: ...

    async def end_active_match_for_session(self, chat_session_id: str) -> None: ...

    async def append_message(
        self,
        *,
        sender_chat_session_id: str,
        recipient_chat_session_id: str,
        content: str,
    ) -> None: ...


class RiskEventRecorder(Protocol):
    async def record(
        self,
        *,
        email_normalized: str,
        outcome: str,
        details: Mapping[str, object],
        account_id: str | None,
        ip_hash: str | None,
        user_agent: str | None,
    ) -> None: ...
