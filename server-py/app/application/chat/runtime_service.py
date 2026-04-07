from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta

from app.application.platform.ports import (
    AuditSink,
    ConnectionHub,
    EventBus,
    FeatureFlagEvaluator,
    JobDispatcher,
    ModerationGateway,
    PermissionGate,
    PresenceRepository,
    SessionRepository,
)
from app.application.platform.services import DurableChatRepository
from app.domain.chat.models import ChatHistoryEntry, ChatSession, MatchResult, utc_now
from app.shared.protocol import PayloadType, UserState


@dataclass(slots=True, frozen=True)
class MessageDispatchResult:
    sender: ChatSession
    partner: ChatSession
    normalized_message: str


@dataclass(slots=True, frozen=True)
class MessageDispatchBlocked:
    reason: str


class ChatRuntimeService:
    def __init__(
        self,
        session_repository: SessionRepository,
        connection_hub: ConnectionHub,
        presence_repository: PresenceRepository,
        permission_gate: PermissionGate,
        feature_flags: FeatureFlagEvaluator,
        moderation_gateway: ModerationGateway,
        audit_sink: AuditSink,
        event_bus: EventBus,
        job_dispatcher: JobDispatcher,
        durable_chat_repository: DurableChatRepository,
        *,
        reconnect_window_seconds: int = 180,
    ) -> None:
        self._session_repository = session_repository
        self._connection_hub = connection_hub
        self._presence_repository = presence_repository
        self._permission_gate = permission_gate
        self._feature_flags = feature_flags
        self._moderation_gateway = moderation_gateway
        self._audit_sink = audit_sink
        self._event_bus = event_bus
        self._job_dispatcher = job_dispatcher
        self._durable_chat_repository = durable_chat_repository
        self._reconnect_window = timedelta(seconds=reconnect_window_seconds)
        self._lock = asyncio.Lock()

    async def prepare_for_startup(self) -> None:
        async with self._lock:
            await self._session_repository.prepare_for_startup(self._reconnect_window)

    async def register_connection(self, session_id: str, websocket) -> None:
        async with self._lock:
            is_first = not self._connection_hub.has(session_id)
            self._connection_hub.register(session_id, websocket)
            await self._presence_repository.mark_online(session_id)

            session = await self._session_repository.load_or_create_session(session_id)
            session.reconnect_deadline = None
            # Only reset state for the first connection; additional tabs inherit the current state.
            if is_first:
                session.is_typing = False
                if session.partner_id is None and session.state in (UserState.CONNECTED, UserState.SEARCHING):
                    session.state = UserState.IDLE
            await self._session_repository.save_session(session)

    async def get_or_create_session(
        self,
        session_id: str,
        name: str | None = None,
        gender: str | None = None,
        short_id: str | None = None,
    ) -> ChatSession:
        async with self._lock:
            session = await self._session_repository.load_or_create_session(session_id)
            if name is not None:
                session.name = await self._normalize_name(name, session_id=session_id, fallback=session.name)
            if gender is not None:
                session.gender = gender
            if short_id is not None:
                session.short_id = short_id
            if name is not None or gender is not None or short_id is not None:
                await self._session_repository.save_session(session)
            return session

    async def update_user_info(self, session_id: str, *, name: str | None = None) -> ChatSession:
        async with self._lock:
            session = await self._session_repository.load_or_create_session(session_id)
            if name is not None:
                session.name = await self._normalize_name(name, session_id=session_id, fallback=session.name)
                await self._session_repository.save_session(session)
                await self._audit_sink.record("chat.profile.updated", {"session_id": session_id})
            return session

    async def enter_queue(self, session_id: str) -> ChatSession:
        async with self._lock:
            if not await self._permission_gate.allow_anonymous_chat(session_id):
                raise PermissionError("Anonymous chat is not permitted")

            await self._feature_flags.is_enabled("chat.queue", session_id=session_id)
            session = await self._session_repository.load_or_create_session(session_id)
            if session.partner_id is not None:
                return session

            session.state = UserState.SEARCHING
            session.is_typing = False
            session.reconnect_deadline = None
            await self._session_repository.save_session(session)
            await self._session_repository.enqueue_waiting(session_id)
            await self._audit_sink.record("chat.queue.entered", {"session_id": session_id})
            return session

    async def try_match(self) -> MatchResult | None:
        async with self._lock:
            while True:
                left_id = await self._pop_matchable_session_id_unlocked()
                if left_id is None:
                    return None

                deferred_session_ids: list[str] = []
                right_id: str | None = None
                while True:
                    candidate_id = await self._pop_matchable_session_id_unlocked(exclude_session_id=left_id)
                    if candidate_id is None:
                        await self._requeue_waiting_front_unlocked([left_id, *deferred_session_ids])
                        return None
                    if await self._sessions_belong_to_same_account_unlocked(left_id, candidate_id):
                        deferred_session_ids.append(candidate_id)
                        continue
                    right_id = candidate_id
                    break

                await self._requeue_waiting_front_unlocked(deferred_session_ids)

                left_session = await self._session_repository.load_session(left_id)
                right_session = await self._session_repository.load_session(right_id)
                if left_session is None or right_session is None:
                    continue

                left_session.state = UserState.CONNECTED
                right_session.state = UserState.CONNECTED
                left_session.partner_id = right_id
                right_session.partner_id = left_id
                left_session.is_typing = False
                right_session.is_typing = False
                left_session.reconnect_deadline = None
                right_session.reconnect_deadline = None

                await self._session_repository.save_session(left_session)
                await self._session_repository.save_session(right_session)
                await self._event_bus.publish(
                    "chat.match.created",
                    {"left_session_id": left_id, "right_session_id": right_id},
                )
                await self._durable_chat_repository.create_match(
                    left_chat_session_id=left_id,
                    right_chat_session_id=right_id,
                )
                return MatchResult(left=left_session, right=right_session)

    async def lookup_current_partner(self, session_id: str) -> ChatSession | None:
        async with self._lock:
            session = await self._session_repository.load_session(session_id)
            if session is None or session.partner_id is None:
                return None
            return await self._session_repository.load_session(session.partner_id)

    async def record_message(
        self,
        sender_session_id: str,
        message: str,
        *,
        client_message_id: str | None = None,
    ) -> MessageDispatchResult | MessageDispatchBlocked | None:
        normalized_message = (
            await self._moderation_gateway.normalize_message(message, session_id=sender_session_id)
        ).strip()
        if not normalized_message:
            return None

        async with self._lock:
            sender = await self._session_repository.load_session(sender_session_id)
            if sender is None or sender.partner_id is None:
                return None

            partner = await self._session_repository.load_session(sender.partner_id)
            if partner is None:
                return None

            if not self._connection_hub.has(partner.session_id):
                if partner.is_reconnect_pending:
                    return MessageDispatchBlocked(reason="partner_temporarily_unavailable")
                return None

            was_persisted = await self._durable_chat_repository.append_message(
                sender_chat_session_id=sender.session_id,
                recipient_chat_session_id=partner.session_id,
                sender_display_name_snapshot=sender.name,
                body=normalized_message,
                client_message_id=client_message_id,
            )
            if not was_persisted and client_message_id is not None:
                return MessageDispatchBlocked(reason="duplicate")

            entry = ChatHistoryEntry(
                payload_type=PayloadType.MESSAGE,
                from_session_id=sender_session_id,
                payload=normalized_message,
            )
            await self._session_repository.append_history(sender.session_id, entry)
            await self._session_repository.append_history(partner.session_id, entry)
            await self._audit_sink.record("chat.message.sent", {"session_id": sender_session_id})
            return MessageDispatchResult(
                sender=sender,
                partner=partner,
                normalized_message=normalized_message,
            )

    async def set_typing(self, session_id: str, *, is_typing: bool) -> str | None:
        async with self._lock:
            session = await self._session_repository.load_session(session_id)
            if session is None:
                return None

            session.is_typing = is_typing
            await self._session_repository.save_session(session)

            if session.partner_id is None:
                return None

            partner = await self._session_repository.load_session(session.partner_id)
            if partner is None:
                return None
            return partner.session_id

    async def disconnect_partner(self, session_id: str, *, end_reason: str = "disconnect") -> str | None:
        async with self._lock:
            session = await self._session_repository.load_session(session_id)
            if session is None:
                return None

            partner_id = session.partner_id
            session.partner_id = None
            session.state = UserState.IDLE
            session.is_typing = False
            await self._session_repository.save_session(session)
            await self._session_repository.clear_history(session_id)
            await self._durable_chat_repository.end_active_match_for_session(
                chat_session_id=session_id,
                end_reason=end_reason,
            )

            if partner_id is None:
                return None

            partner = await self._session_repository.load_session(partner_id)
            if partner is None:
                return None

            # Only reset the partner if they still consider us their partner.
            # If the partner already clicked "next" (partner_id cleared or changed),
            # they may be SEARCHING in queue — resetting them would silently invalidate their queue entry.
            if partner.partner_id is not None and partner.partner_id != session_id:
                return None

            if partner.partner_id == session_id:
                partner.partner_id = None
                partner.state = UserState.IDLE
                partner.is_typing = False
                partner.reconnect_deadline = None
                await self._session_repository.save_session(partner)
                await self._session_repository.clear_history(partner.session_id)
            await self._session_repository.append_history(
                partner.session_id,
                ChatHistoryEntry(
                    payload_type=PayloadType.DISCONNECT,
                    from_session_id=session_id,
                    payload="Partner disconnected",
                ),
            )
            await self._audit_sink.record("chat.partner.disconnected", {"session_id": session_id})
            return partner_id

    async def mark_disconnected(self, session_id: str, *, force: bool = False) -> None:
        async with self._lock:
            if force:
                self._connection_hub.unregister(session_id)
            elif self._connection_hub.has(session_id):
                # Other tabs still hold an active connection; do not tear down the session.
                return

            await self._presence_repository.mark_offline(session_id)
            await self._session_repository.remove_from_waiting_queue(session_id)

            session = await self._session_repository.load_session(session_id)
            if session is None:
                return

            session.is_typing = False
            session.reconnect_deadline = utc_now() + self._reconnect_window
            await self._session_repository.save_session(session)

    async def expire_stale_sessions(self) -> list[str]:
        async with self._lock:
            partner_ids_to_notify: list[str] = []
            for session_id in await self._session_repository.list_expired_session_ids(utc_now()):
                partner_id = await self._remove_session_unlocked(
                    session_id,
                    durable_close_reason="expired",
                    audit_event_type="chat.session.expired",
                )
                await self._job_dispatcher.dispatch("chat.session.expired", {"session_id": session_id})
                if partner_id is not None:
                    partner_ids_to_notify.append(partner_id)
            return partner_ids_to_notify

    async def revoke_session(self, session_id: str, *, close_reason: str) -> str | None:
        async with self._lock:
            return await self._remove_session_unlocked(
                session_id,
                durable_close_reason=close_reason,
                audit_event_type="chat.session.revoked",
            )

    async def queue_size(self) -> int:
        async with self._lock:
            return await self._session_repository.queue_size()

    async def _pop_matchable_session_id_unlocked(self, *, exclude_session_id: str | None = None) -> str | None:
        while True:
            candidate_id = await self._session_repository.pop_waiting()
            if candidate_id is None:
                return None
            if exclude_session_id is not None and candidate_id == exclude_session_id:
                continue
            if await self._can_participate_in_match_unlocked(candidate_id):
                return candidate_id

    async def _can_participate_in_match_unlocked(self, session_id: str) -> bool:
        session = await self._session_repository.load_session(session_id)
        if session is None:
            return False
        if session.state is not UserState.SEARCHING:
            return False
        if session.partner_id is not None:
            return False
        if session.is_reconnect_pending:
            return False
        if not self._connection_hub.has(session_id):
            return False
        return await self._presence_repository.is_online(session_id)

    async def _sessions_belong_to_same_account_unlocked(self, left_id: str, right_id: str) -> bool:
        left_account_id = await self._durable_chat_repository.get_account_id_for_chat_session(left_id)
        right_account_id = await self._durable_chat_repository.get_account_id_for_chat_session(right_id)
        # If either account lookup fails, conservatively treat as same account to prevent self-chat.
        if left_account_id is None or right_account_id is None:
            return True
        return left_account_id == right_account_id

    async def _requeue_waiting_front_unlocked(self, session_ids: list[str]) -> None:
        for session_id in reversed(session_ids):
            await self._session_repository.enqueue_waiting_front(session_id)

    async def _remove_session_unlocked(
        self,
        session_id: str,
        *,
        durable_close_reason: str,
        audit_event_type: str,
    ) -> str | None:
        self._connection_hub.unregister(session_id)
        await self._presence_repository.mark_offline(session_id)
        await self._session_repository.remove_from_waiting_queue(session_id)

        session = await self._session_repository.load_session(session_id)
        await self._session_repository.delete_session(session_id)
        await self._durable_chat_repository.end_active_match_for_session(
            chat_session_id=session_id,
            end_reason=durable_close_reason,
        )
        if durable_close_reason == "expired":
            await self._durable_chat_repository.expire_chat_session(chat_session_id=session_id)
        else:
            await self._durable_chat_repository.close_chat_session(
                chat_session_id=session_id,
                close_reason=durable_close_reason,
            )
        if session is None or session.partner_id is None:
            await self._audit_sink.record(audit_event_type, {"session_id": session_id})
            return None

        partner = await self._session_repository.load_session(session.partner_id)
        if partner is None:
            return None

        partner.partner_id = None
        partner.state = UserState.IDLE
        partner.is_typing = False
        partner.reconnect_deadline = None
        await self._session_repository.save_session(partner)
        await self._session_repository.clear_history(partner.session_id)
        await self._session_repository.append_history(
            partner.session_id,
            ChatHistoryEntry(
                payload_type=PayloadType.DISCONNECT,
                from_session_id=session_id,
                payload="Partner disconnected",
            ),
        )
        await self._audit_sink.record(audit_event_type, {"session_id": session_id})
        return partner.session_id

    async def _normalize_name(self, name: str, *, session_id: str, fallback: str) -> str:
        normalized = (await self._moderation_gateway.normalize_profile_name(name, session_id=session_id)).strip()
        return normalized or fallback
