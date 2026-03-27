from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field

from app.application.platform.services import GeeTestCaptchaPayload
from app.application.auth.service import AuthTokenBundle, RegistrationResult
from app.bootstrap.container import ApplicationContainer
from app.presentation.http.dependencies import CurrentAuthDep, get_container

router = APIRouter()
ContainerOnlyDep = Annotated[ApplicationContainer, Depends(get_container)]


class GeeTestCaptchaRequest(BaseModel):
    lot_number: str = Field(..., min_length=1)
    captcha_output: str = Field(..., min_length=1)
    pass_token: str = Field(..., min_length=1)
    gen_time: str = Field(..., min_length=1)

    def to_payload(self) -> GeeTestCaptchaPayload:
        return GeeTestCaptchaPayload(
            lot_number=self.lot_number,
            captcha_output=self.captcha_output,
            pass_token=self.pass_token,
            gen_time=self.gen_time,
        )


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = Field(..., min_length=1, max_length=80)
    interests: list[str] = Field(default_factory=list)
    captcha: GeeTestCaptchaRequest


class LoginRequest(BaseModel):
    email: str
    password: str
    captcha: GeeTestCaptchaRequest


class VerifyCodeRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    email: str


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
        "is_admin": session_view.is_admin,
        "chat_access_restricted": session_view.chat_access_restricted,
    }


def _registration_result_dict(result: RegistrationResult) -> dict[str, object]:
    return {"status": result.status, "masked_email": result.masked_email}


@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    container: ContainerOnlyDep,
) -> dict[str, object]:
    result = await container.auth_service.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
        interests=payload.interests,
        captcha_payload=payload.captcha.to_payload(),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return _registration_result_dict(result)


@router.post("/api/auth/login")
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    container: ContainerOnlyDep,
) -> dict[str, object]:
    result = await container.auth_service.login(
        email=payload.email,
        password=payload.password,
        captcha_payload=payload.captcha.to_payload(),
        ip_address=request.client.host if request.client else None,
    )
    if isinstance(result, AuthTokenBundle):
        _set_auth_cookie(response, container, result.raw_session_token)
        return _session_dict(result.auth_session)
    return _registration_result_dict(result)


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
async def verify_email(
    payload: VerifyCodeRequest, response: Response, container: ContainerOnlyDep,
) -> dict[str, object]:
    bundle = await container.auth_service.verify_code(email=payload.email, code=payload.code)
    _set_auth_cookie(response, container, bundle.raw_session_token)
    return _session_dict(bundle.auth_session)


@router.post("/api/auth/resend-verification")
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    container: ContainerOnlyDep,
) -> dict[str, str]:
    await container.auth_service.resend_verification(
        email=payload.email,
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "ok"}


@router.get("/api/auth/session")
async def get_auth_session(auth: CurrentAuthDep) -> dict[str, object]:
    _, session_view = auth
    return _session_dict(session_view)


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
