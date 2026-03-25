from __future__ import annotations

from app.application.platform.ports import ReadinessProbe


class CompositeReadinessProbe:
    def __init__(self, *probes: ReadinessProbe) -> None:
        self._probes = probes

    async def ping(self) -> None:
        for probe in self._probes:
            await probe.ping()
