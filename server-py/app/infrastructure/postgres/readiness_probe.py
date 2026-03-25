from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class DatabaseReadinessProbe:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def ping(self) -> None:
        async with self._session_factory() as session:
            await session.execute(text("SELECT 1"))
