from redis.asyncio import Redis


class RedisReadinessProbe:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def ping(self) -> None:
        await self._redis.ping()
