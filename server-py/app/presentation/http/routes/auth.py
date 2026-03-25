from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import CurrentAccountDep, CurrentAuthDep, get_container

router = APIRouter()
ContainerOnlyDep = Annotated[ApplicationContainer, Depends(get_container)]


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = Field(..., min_length=1, max_length=80)
    interests: list[str] = Field(default_factory=list)
    turnstile_token: str = Field(..., min_length=1)


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


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


@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    container: ContainerOnlyDep,
) -> dict[str, object]:
    bundle = await container.auth_service.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
        interests=payload.interests,
        turnstile_token=payload.turnstile_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    _set_auth_cookie(response, container, bundle.raw_session_token)
    return {
        "authenticated": bundle.auth_session.authenticated,
        "email_verified": bundle.auth_session.email_verified,
        "display_name": bundle.auth_session.display_name,
        "interests": bundle.auth_session.interests or [],
    }


@router.post("/api/auth/login")
async def login(payload: LoginRequest, response: Response, container: ContainerOnlyDep) -> dict[str, object]:
    bundle = await container.auth_service.login(email=payload.email, password=payload.password)
    _set_auth_cookie(response, container, bundle.raw_session_token)
    return {
        "authenticated": bundle.auth_session.authenticated,
        "email_verified": bundle.auth_session.email_verified,
        "display_name": bundle.auth_session.display_name,
        "interests": bundle.auth_session.interests or [],
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


@router.post("/api/auth/verify-email")
async def verify_email(payload: VerifyEmailRequest, container: ContainerOnlyDep) -> dict[str, object]:
    session_view = await container.auth_service.verify_email(raw_token=payload.token)
    return {
        "authenticated": session_view.authenticated,
        "email_verified": session_view.email_verified,
        "display_name": session_view.display_name,
        "interests": session_view.interests or [],
    }


@router.post("/api/auth/resend-verification")
async def resend_verification(account_id: CurrentAccountDep, container: ContainerOnlyDep) -> dict[str, object]:
    session_view = await container.auth_service.resend_verification(account_id=account_id)
    return {
        "authenticated": session_view.authenticated,
        "email_verified": session_view.email_verified,
        "display_name": session_view.display_name,
        "interests": session_view.interests or [],
    }


@router.get("/api/auth/session")
async def get_auth_session(auth: CurrentAuthDep) -> dict[str, object]:
    _, session_view = auth
    return {
        "authenticated": session_view.authenticated,
        "email_verified": session_view.email_verified,
        "display_name": session_view.display_name,
        "interests": session_view.interests or [],
    }


class RequestPasswordResetRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


@router.post("/api/auth/request-password-reset")
async def request_password_reset(payload: RequestPasswordResetRequest, container: ContainerOnlyDep) -> dict[str, str]:
    await container.auth_service.request_password_reset(email=payload.email)
    return {"status": "ok"}


@router.post("/api/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest, container: ContainerOnlyDep) -> dict[str, str]:
    await container.auth_service.reset_password(raw_token=payload.token, new_password=payload.new_password)
    return {"status": "ok"}
