class NoOpModerationGateway:
    async def normalize_profile_name(self, name: str, *, session_id: str) -> str:
        _ = session_id
        return name

    async def normalize_message(self, message: str, *, session_id: str) -> str:
        _ = session_id
        return message
