from collections.abc import Mapping
from typing import Any


class NoOpAuditSink:
    async def record(self, event: str, payload: Mapping[str, Any]) -> None:
        _ = (event, payload)
