from app.shared.config import get_settings
from redis.asyncio import Redis


def create_redis_client() -> Redis:
    settings = get_settings()
    return Redis.from_url(settings.redis_url, decode_responses=True)


redis_client: Redis | None = None


def init_redis_client() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = create_redis_client()
    return redis_client


async def close_redis_client() -> None:
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


async def get_redis_client() -> Redis:
    if redis_client is None:
        return init_redis_client()
    return redis_client
