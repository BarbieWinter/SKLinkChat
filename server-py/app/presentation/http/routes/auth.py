from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import extract_stack_access_token, get_container

router = APIRouter()
ContainerOnlyDep = Annotated[ApplicationContainer, Depends(get_container)]


def _set_auth_cookie(response: Response, container: ApplicationContainer, raw_session_token: str) -> None:
    response.set_cookie(
        key=container.settings.auth_cookie_name,
        value=raw_session_token,
        max_age=container.settings.auth_session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=container.settings.secure_cookies,
        path="/",
    )


def _clear_auth_cookie(response: Response, container: ApplicationContainer) -> None:
    response.delete_cookie(
        key=container.settings.auth_cookie_name,
        httponly=True,
        samesite="lax",
        secure=container.settings.secure_cookies,
        path="/",
    )


def _session_dict(session_view) -> dict[str, object]:
    return {
        "authenticated": session_view.authenticated,
        "email_verified": session_view.email_verified,
        "display_name": session_view.display_name,
        "short_id": session_view.short_id,
        "interests": session_view.interests or [],
        "gender": session_view.gender,
        "is_admin": session_view.is_admin,
        "chat_access_restricted": session_view.chat_access_restricted,
    }


@router.post("/api/auth/logout")
async def logout(
    request: Request,
    response: Response,
    container: ContainerOnlyDep,
) -> dict[str, str]:
    await container.auth_service.logout(raw_session_token=request.cookies.get(container.settings.auth_cookie_name))
    _clear_auth_cookie(response, container)
    return {"status": "ok"}

@router.get("/api/auth/session")
async def get_auth_session(
    request: Request,
    response: Response,
    container: ContainerOnlyDep,
) -> dict[str, object]:
    raw_session_token = request.cookies.get(container.settings.auth_cookie_name)
    stack_access_token = extract_stack_access_token(request)
    account_id, session_view = await container.resolve_auth_session.execute(
        raw_session_token,
        stack_access_token=stack_access_token,
    )
    if account_id is not None and stack_access_token:
        bundle = await container.auth_service.create_session_for_account_id(account_id)
        _set_auth_cookie(response, container, bundle.raw_session_token)
    return _session_dict(session_view)
