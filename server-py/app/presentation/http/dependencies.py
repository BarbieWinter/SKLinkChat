from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.bootstrap.container import ApplicationContainer
from app.shared.errors import AppError


def get_container(request: Request) -> ApplicationContainer:
    return request.app.state.container


ContainerDep = Annotated[ApplicationContainer, Depends(get_container)]


async def get_current_auth(request: Request, container: ContainerDep) -> tuple[str | None, object]:
    raw_token = request.cookies.get(container.settings.auth_cookie_name)
    return await container.resolve_auth_session.execute(raw_token)


CurrentAuthDep = Annotated[tuple[str | None, object], Depends(get_current_auth)]


async def require_authenticated_account(auth: CurrentAuthDep) -> str:
    account_id, auth_session = auth
    if account_id is None or not getattr(auth_session, "authenticated", False):
        raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
    return account_id


CurrentAccountDep = Annotated[str, Depends(require_authenticated_account)]
