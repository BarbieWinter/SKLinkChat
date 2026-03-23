from collections.abc import Mapping
from typing import Any


class RedisEventBus:
    async def publish(self, topic: str, payload: Mapping[str, Any]) -> None:
        _ = (topic, payload)
