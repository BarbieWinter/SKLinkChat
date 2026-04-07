from __future__ import annotations

import json
from collections.abc import Awaitable, Iterable
from datetime import UTC, datetime, timedelta
from typing import cast

from app.domain.chat.models import ChatHistoryEntry, ChatSession, utc_now
from app.shared.protocol import PayloadType, UserState
from redis.asyncio import Redis


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat()


def _deserialize_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


class RedisSessionRepository:
    def __init__(
        self,
        redis: Redis,
        *,
        history_limit: int,
        default_name_prefix: str,
        key_prefix: str = "chat",
    ) -> None:
        self._redis = redis
        self._history_limit = history_limit
        self._default_name_prefix = default_name_prefix
        self._sessions_key = f"{key_prefix}:sessions"
        self._queue_key = f"{key_prefix}:queue"
        self._reconnect_deadlines_key = f"{key_prefix}:reconnect_deadlines"
        self._name_counter_key = f"{key_prefix}:name_counter"
        self._session_key_prefix = f"{key_prefix}:session"
        self._history_key_prefix = f"{key_prefix}:history"

    async def prepare_for_startup(self, reconnect_window: timedelta) -> None:
        await self._delete(self._queue_key)
        await self._delete(self._reconnect_deadlines_key)

        reconnect_deadline = utc_now() + reconnect_window
        for session_id in await self._smembers(self._sessions_key):
            session = await self.load_session(session_id)
            if session is None:
                continue

            session.is_typing = False
            if session.partner_id is None:
                session.state = UserState.IDLE
                session.reconnect_deadline = None
            else:
                session.state = UserState.CONNECTED
                session.reconnect_deadline = reconnect_deadline

            await self.save_session(session)

    async def load_or_create_session(self, session_id: str) -> ChatSession:
        session = await self.load_session(session_id)
        if session is not None:
            return session

        next_index = await self._incr(self._name_counter_key)
        session = ChatSession(session_id=session_id, name=f"{self._default_name_prefix}-{next_index:04d}")
        await self.save_session(session)
        return session

    async def load_session(self, session_id: str, *, include_history: bool = False) -> ChatSession | None:
        raw_session = await self._get(self._session_key(session_id))
        if raw_session is None:
            return None

        payload = json.loads(raw_session)
        recent_history: list[ChatHistoryEntry] = []
        if include_history:
            recent_history = await self.load_recent_history(session_id)

        return ChatSession(
            session_id=payload["session_id"],
            name=payload["name"],
            gender=payload.get("gender", "unknown"),
            short_id=payload.get("short_id"),
            state=UserState(payload["state"]),
            partner_id=payload.get("partner_id"),
            is_typing=bool(payload.get("is_typing", False)),
            reconnect_deadline=_deserialize_datetime(payload.get("reconnect_deadline")),
            recent_history=recent_history,
        )

    async def save_session(self, session: ChatSession) -> None:
        payload = {
            "session_id": session.session_id,
            "name": session.name,
            "gender": session.gender,
            "short_id": session.short_id,
            "state": session.state.value,
            "partner_id": session.partner_id,
            "is_typing": session.is_typing,
            "reconnect_deadline": _serialize_datetime(session.reconnect_deadline),
        }

        await self._set(self._session_key(session.session_id), json.dumps(payload))
        await self._sadd(self._sessions_key, session.session_id)

        if session.reconnect_deadline is None:
            await self._zrem(self._reconnect_deadlines_key, session.session_id)
        else:
            await self._zadd(
                self._reconnect_deadlines_key,
                {session.session_id: session.reconnect_deadline.timestamp()},
            )

    async def delete_session(self, session_id: str) -> None:
        await self.remove_from_waiting_queue(session_id)
        await self._delete(self._session_key(session_id))
        await self._delete(self._history_key(session_id))
        await self._srem(self._sessions_key, session_id)
        await self._zrem(self._reconnect_deadlines_key, session_id)

    async def list_expired_session_ids(self, now: datetime) -> list[str]:
        return await self._zrangebyscore(self._reconnect_deadlines_key, "-inf", now.timestamp())

    async def enqueue_waiting(self, session_id: str) -> None:
        await self.remove_from_waiting_queue(session_id)
        await self._rpush(self._queue_key, session_id)

    async def enqueue_waiting_front(self, session_id: str) -> None:
        await self.remove_from_waiting_queue(session_id)
        await self._lpush(self._queue_key, session_id)

    async def pop_waiting(self) -> str | None:
        return await self._lpop(self._queue_key)

    async def remove_from_waiting_queue(self, session_id: str) -> None:
        await self._lrem(self._queue_key, 0, session_id)

    async def queue_size(self) -> int:
        return await self._llen(self._queue_key)

    async def append_history(self, session_id: str, entry: ChatHistoryEntry) -> None:
        payload = json.dumps(
            {
                "payload_type": entry.payload_type.value,
                "from_session_id": entry.from_session_id,
                "payload": entry.payload,
                "created_at": _serialize_datetime(entry.created_at),
            }
        )
        await self._rpush(self._history_key(session_id), payload)
        await self._ltrim(self._history_key(session_id), -self._history_limit, -1)

    async def load_recent_history(self, session_id: str) -> list[ChatHistoryEntry]:
        entries = await self._lrange(self._history_key(session_id), 0, -1)
        return [self._deserialize_history_entry(raw_entry) for raw_entry in entries]

    async def clear_history(self, session_id: str) -> None:
        await self._delete(self._history_key(session_id))

    @staticmethod
    def _deserialize_history_entry(raw_entry: str) -> ChatHistoryEntry:
        payload = json.loads(raw_entry)
        created_at = _deserialize_datetime(payload.get("created_at"))
        return ChatHistoryEntry(
            payload_type=PayloadType(payload["payload_type"]),
            from_session_id=payload["from_session_id"],
            payload=payload["payload"],
            created_at=created_at or utc_now(),
        )

    def _session_key(self, session_id: str) -> str:
        return f"{self._session_key_prefix}:{session_id}"

    def _history_key(self, session_id: str) -> str:
        return f"{self._history_key_prefix}:{session_id}"

    async def _get(self, key: str) -> str | None:
        return await cast(Awaitable[str | None], self._redis.get(key))

    async def _set(self, key: str, value: str) -> None:
        await cast(Awaitable[bool], self._redis.set(key, value))

    async def _delete(self, key: str) -> int:
        return int(await cast(Awaitable[int], self._redis.delete(key)))

    async def _incr(self, key: str) -> int:
        return int(await cast(Awaitable[int], self._redis.incr(key)))

    async def _smembers(self, key: str) -> set[str]:
        return {str(value) for value in await cast(Awaitable[Iterable[str]], self._redis.smembers(key))}

    async def _sadd(self, key: str, value: str) -> None:
        await cast(Awaitable[int], self._redis.sadd(key, value))

    async def _srem(self, key: str, value: str) -> None:
        await cast(Awaitable[int], self._redis.srem(key, value))

    async def _rpush(self, key: str, value: str) -> None:
        await cast(Awaitable[int], self._redis.rpush(key, value))

    async def _lpush(self, key: str, value: str) -> None:
        await cast(Awaitable[int], self._redis.lpush(key, value))

    async def _lpop(self, key: str) -> str | None:
        return await cast(Awaitable[str | None], self._redis.lpop(key))

    async def _lrem(self, key: str, count: int, value: str) -> None:
        await cast(Awaitable[int], self._redis.lrem(key, count, value))

    async def _llen(self, key: str) -> int:
        return int(await cast(Awaitable[int], self._redis.llen(key)))

    async def _lrange(self, key: str, start: int, end: int) -> list[str]:
        return list(await cast(Awaitable[list[str]], self._redis.lrange(key, start, end)))

    async def _ltrim(self, key: str, start: int, end: int) -> None:
        await cast(Awaitable[bool], self._redis.ltrim(key, start, end))

    async def _zadd(self, key: str, mapping: dict[str, float]) -> None:
        await cast(Awaitable[int], self._redis.zadd(key, mapping))

    async def _zrem(self, key: str, member: str) -> None:
        await cast(Awaitable[int], self._redis.zrem(key, member))

    async def _zrangebyscore(self, key: str, minimum: str | float, maximum: float) -> list[str]:
        return list(await cast(Awaitable[list[str]], self._redis.zrangebyscore(key, minimum, maximum)))
