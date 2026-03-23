from starlette.websockets import WebSocket


class InMemoryConnectionHub:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    def register(self, session_id: str, websocket: WebSocket) -> WebSocket | None:
        previous = self._connections.get(session_id)
        self._connections[session_id] = websocket
        return previous

    def unregister(self, session_id: str) -> WebSocket | None:
        return self._connections.pop(session_id, None)

    def get(self, session_id: str) -> WebSocket | None:
        return self._connections.get(session_id)

    def has(self, session_id: str) -> bool:
        return session_id in self._connections

    def active_count(self) -> int:
        return len(self._connections)
