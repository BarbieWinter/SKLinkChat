from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.bootstrap.container import ApplicationContainer
from app.shared.errors import AppError


def get_container(request: Request) -> ApplicationContainer:
    return request.app.state.container


ContainerDep = Annotated[ApplicationContainer, Depends(get_container)]


def extract_stack_access_token(request: Request) -> str | None:
    token = (request.headers.get("x-stack-access-token") or "").strip()
    if token:
        return token

    authorization = (request.headers.get("authorization") or "").strip()
    if authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()
        if bearer:
            return bearer
    return None


async def get_current_auth(request: Request, container: ContainerDep) -> tuple[str | None, object]:
    raw_token = request.cookies.get(container.settings.auth_cookie_name)
    stack_access_token = extract_stack_access_token(request)
    return await container.resolve_auth_session.execute(raw_token, stack_access_token=stack_access_token)


CurrentAuthDep = Annotated[tuple[str | None, object], Depends(get_current_auth)]


async def require_authenticated_account(auth: CurrentAuthDep) -> str:
    account_id, auth_session = auth
    if account_id is None or not getattr(auth_session, "authenticated", False):
        raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
    return account_id


CurrentAccountDep = Annotated[str, Depends(require_authenticated_account)]


async def require_admin_account(auth: CurrentAuthDep) -> str:
    account_id, auth_session = auth
    if account_id is None or not getattr(auth_session, "authenticated", False):
        raise AppError(message="Authentication required", code="UNAUTHENTICATED", status_code=401)
    if not getattr(auth_session, "is_admin", False):
        raise AppError(message="Admin access is required", code="ADMIN_FORBIDDEN", status_code=403)
    return account_id


CurrentAdminAccountDep = Annotated[str, Depends(require_admin_account)]
