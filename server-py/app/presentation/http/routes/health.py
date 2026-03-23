import logging
from typing import Annotated

from fastapi import APIRouter, Depends

from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import get_container

router = APIRouter()
logger = logging.getLogger("app.health")
ContainerDep = Annotated[ApplicationContainer, Depends(get_container)]


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(container: ContainerDep) -> dict[str, str]:
    try:
        return await container.readiness_check.execute()
    except Exception:
        logger.warning("readiness check failed", extra={"request_id": "n/a"})
        raise


@router.get("/api/users/count")
async def users_count(container: ContainerDep) -> dict[str, int]:
    return await container.online_user_count.execute()
