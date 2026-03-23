class NoOpPermissionGate:
    async def allow_anonymous_chat(self, session_id: str) -> bool:
        _ = session_id
        return True
