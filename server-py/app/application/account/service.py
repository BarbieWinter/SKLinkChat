from __future__ import annotations

from dataclasses import dataclass

from app.application.auth.service import normalize_display_name, normalize_gender, normalize_interests
from app.infrastructure.postgres.repositories import AccountRepository
from app.shared.errors import AppError


@dataclass(slots=True, frozen=True)
class AccountProfileView:
    display_name: str
    interests: list[str]
    gender: str


class AccountService:
    def __init__(self, account_repository: AccountRepository) -> None:
        self._account_repository = account_repository

    async def get_profile(self, account_id: str) -> AccountProfileView:
        account = await self._account_repository.get_by_id(account_id)
        if account is None:
            raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
        interests = await self._account_repository.list_interests(account.id)
        return AccountProfileView(display_name=account.display_name, interests=interests, gender=account.gender)

    async def update_profile(
        self,
        *,
        account_id: str,
        display_name: str,
        interests: list[str],
        gender: str,
    ) -> AccountProfileView:
        account = await self._account_repository.update_profile(
            account_id=account_id,
            display_name=normalize_display_name(display_name),
            interests=normalize_interests(interests),
            gender=normalize_gender(gender),
        )
        interests = await self._account_repository.list_interests(account.id)
        return AccountProfileView(display_name=account.display_name, interests=interests, gender=account.gender)
