from collections.abc import Awaitable
from typing import cast

from redis.asyncio import Redis


class RedisPresenceRepository:
    def __init__(self, redis: Redis, online_sessions_key: str = "presence:online:sessions") -> None:
        self._redis = redis
        self._online_sessions_key = online_sessions_key

    async def reset_online(self) -> None:
        await cast(Awaitable[int], self._redis.delete(self._online_sessions_key))

    async def mark_online(self, session_id: str) -> bool:
        return bool(await cast(Awaitable[int], self._redis.sadd(self._online_sessions_key, session_id)))

    async def mark_offline(self, session_id: str) -> bool:
        return bool(await cast(Awaitable[int], self._redis.srem(self._online_sessions_key, session_id)))

    async def is_online(self, session_id: str) -> bool:
        return bool(
            await cast(
                Awaitable[bool | int],
                self._redis.sismember(self._online_sessions_key, session_id),
            )
        )

    async def online_count(self) -> int:
        return int(await cast(Awaitable[int], self._redis.scard(self._online_sessions_key)))
