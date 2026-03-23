from collections.abc import Mapping
from typing import Any


class InlineJobDispatcher:
    async def dispatch(self, job_name: str, payload: Mapping[str, Any]) -> None:
        _ = (job_name, payload)
