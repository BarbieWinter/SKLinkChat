class NoOpFeatureFlagEvaluator:
    async def is_enabled(self, key: str, *, session_id: str | None = None) -> bool:
        _ = (key, session_id)
        return False
