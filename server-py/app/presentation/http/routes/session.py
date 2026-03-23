from typing import Annotated

from fastapi import APIRouter, Depends

from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import get_container

router = APIRouter()
ContainerDep = Annotated[ApplicationContainer, Depends(get_container)]


@router.post("/api/session")
async def create_session(container: ContainerDep) -> dict[str, str]:
    return container.create_anonymous_session.execute()
