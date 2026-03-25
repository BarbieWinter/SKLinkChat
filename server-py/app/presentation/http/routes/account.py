from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.presentation.http.dependencies import ContainerDep, CurrentAccountDep

router = APIRouter()


class UpdateAccountProfileRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=80)
    interests: list[str] = Field(default_factory=list)


@router.get("/api/account/profile")
async def get_account_profile(account_id: CurrentAccountDep, container: ContainerDep) -> dict[str, object]:
    profile = await container.get_account_profile.execute(account_id)
    return {"display_name": profile.display_name, "interests": profile.interests}


@router.patch("/api/account/profile")
async def update_account_profile(
    payload: UpdateAccountProfileRequest,
    account_id: CurrentAccountDep,
    container: ContainerDep,
) -> dict[str, object]:
    profile = await container.update_account_profile.execute(
        account_id=account_id,
        display_name=payload.display_name,
        interests=payload.interests,
    )
    return {"display_name": profile.display_name, "interests": profile.interests}
