import asyncio

from app.infrastructure.redis.presence_repository import RedisPresenceRepository
from tests.fakes import FakeRedis


def test_mark_online_and_online_count_behavior():
    async def scenario() -> None:
        service = RedisPresenceRepository(FakeRedis())

        assert await service.online_count() == 0
        assert await service.mark_online("session-1") is True
        assert await service.mark_online("session-1") is False
        assert await service.mark_online("session-2") is True
        assert await service.online_count() == 2

    asyncio.run(scenario())


def test_reset_online_clears_stale_presence():
    async def scenario() -> None:
        service = RedisPresenceRepository(FakeRedis())
        await service.mark_online("session-1")
        await service.mark_online("session-2")

        assert await service.online_count() == 2
        await service.reset_online()
        assert await service.online_count() == 0

    asyncio.run(scenario())


def test_mark_offline_decrements_count_and_reports_membership():
    async def scenario() -> None:
        service = RedisPresenceRepository(FakeRedis())
        await service.mark_online("session-1")
        await service.mark_online("session-2")

        assert await service.is_online("session-1") is True
        assert await service.mark_offline("session-1") is True
        assert await service.mark_offline("session-1") is False
        assert await service.is_online("session-1") is False
        assert await service.is_online("session-2") is True
        assert await service.online_count() == 1

    asyncio.run(scenario())
