from __future__ import annotations

from starlette.websockets import WebSocket


class InMemoryConnectionHub:
    """Manages WebSocket connections, supporting multiple tabs per session."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    def register(self, session_id: str, websocket: WebSocket) -> None:
        ws_list = self._connections.get(session_id)
        if ws_list is None:
            self._connections[session_id] = [websocket]
        else:
            ws_list.append(websocket)

    def unregister(self, session_id: str) -> None:
        self._connections.pop(session_id, None)

    def unregister_ws(self, session_id: str, websocket: WebSocket) -> int:
        """Remove a specific WebSocket. Returns the remaining count for this session."""
        ws_list = self._connections.get(session_id)
        if ws_list is None:
            return 0
        try:
            ws_list.remove(websocket)
        except ValueError:
            pass
        if not ws_list:
            del self._connections[session_id]
            return 0
        return len(ws_list)

    def get(self, session_id: str) -> WebSocket | None:
        ws_list = self._connections.get(session_id)
        if ws_list:
            return ws_list[0]
        return None

    def get_all(self, session_id: str) -> list[WebSocket]:
        return list(self._connections.get(session_id, []))

    def has(self, session_id: str) -> bool:
        ws_list = self._connections.get(session_id)
        return bool(ws_list)

    def active_count(self) -> int:
        return len(self._connections)

    def snapshot(self) -> tuple[tuple[str, WebSocket], ...]:
        result: list[tuple[str, WebSocket]] = []
        for session_id, ws_list in self._connections.items():
            for ws in ws_list:
                result.append((session_id, ws))
        return tuple(result)
