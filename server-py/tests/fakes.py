class FakeRedis:
    def __init__(self) -> None:
        self._values: dict[str, str] = {}
        self._lists: dict[str, list[str]] = {}
        self._sets: dict[str, set[str]] = {}
        self._zsets: dict[str, dict[str, float]] = {}

    async def ping(self) -> bool:
        return True

    async def delete(self, key: str) -> int:
        removed = 0
        for store in (self._values, self._lists, self._sets, self._zsets):
            if key in store:
                store.pop(key, None)
                removed += 1
        return removed

    async def get(self, key: str) -> str | None:
        return self._values.get(key)

    async def set(self, key: str, value: str) -> bool:
        self._values[key] = value
        return True

    async def incr(self, key: str) -> int:
        next_value = int(self._values.get(key, "0")) + 1
        self._values[key] = str(next_value)
        return next_value

    async def sadd(self, key: str, member: str) -> int:
        members = self._sets.setdefault(key, set())
        before = len(members)
        members.add(member)
        return 1 if len(members) > before else 0

    async def srem(self, key: str, member: str) -> int:
        members = self._sets.get(key, set())
        if member not in members:
            return 0
        members.remove(member)
        return 1

    async def sismember(self, key: str, member: str) -> int:
        members = self._sets.get(key, set())
        return 1 if member in members else 0

    async def scard(self, key: str) -> int:
        return len(self._sets.get(key, set()))

    async def smembers(self, key: str) -> set[str]:
        return set(self._sets.get(key, set()))

    async def rpush(self, key: str, value: str) -> int:
        items = self._lists.setdefault(key, [])
        items.append(value)
        return len(items)

    async def lpush(self, key: str, value: str) -> int:
        items = self._lists.setdefault(key, [])
        items.insert(0, value)
        return len(items)

    async def lpop(self, key: str) -> str | None:
        items = self._lists.get(key, [])
        if not items:
            return None
        return items.pop(0)

    async def lrem(self, key: str, count: int, value: str) -> int:
        items = self._lists.get(key, [])
        removed = 0

        if count >= 0:
            retained: list[str] = []
            for item in items:
                should_remove = item == value and (count == 0 or removed < count)
                if should_remove:
                    removed += 1
                    continue
                retained.append(item)
            self._lists[key] = retained
            return removed

        retained_reverse: list[str] = []
        for item in reversed(items):
            should_remove = item == value and removed < abs(count)
            if should_remove:
                removed += 1
                continue
            retained_reverse.append(item)
        self._lists[key] = list(reversed(retained_reverse))
        return removed

    async def llen(self, key: str) -> int:
        return len(self._lists.get(key, []))

    async def lrange(self, key: str, start: int, end: int) -> list[str]:
        items = self._lists.get(key, [])
        normalized_start = start if start >= 0 else max(len(items) + start, 0)
        normalized_end = end if end >= 0 else len(items) + end
        if normalized_end < 0:
            return []
        return items[normalized_start : normalized_end + 1]

    async def ltrim(self, key: str, start: int, end: int) -> bool:
        items = self._lists.get(key, [])
        normalized_start = start if start >= 0 else max(len(items) + start, 0)
        normalized_end = end if end >= 0 else len(items) + end
        if normalized_end < normalized_start:
            self._lists[key] = []
            return True
        self._lists[key] = items[normalized_start : normalized_end + 1]
        return True

    async def zadd(self, key: str, mapping: dict[str, float]) -> int:
        members = self._zsets.setdefault(key, {})
        before = len(members)
        members.update(mapping)
        return len(members) - before

    async def zrem(self, key: str, member: str) -> int:
        members = self._zsets.get(key, {})
        if member not in members:
            return 0
        members.pop(member, None)
        return 1

    async def zrangebyscore(self, key: str, minimum: str | float, maximum: float) -> list[str]:
        minimum_value = float("-inf") if minimum == "-inf" else float(minimum)
        members = self._zsets.get(key, {})
        return [
            member
            for member, score in sorted(members.items(), key=lambda item: (item[1], item[0]))
            if minimum_value <= score <= maximum
        ]

    async def aclose(self) -> None:
        return None
