import logging
import uuid
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.bootstrap.lifespan import lifespan
from app.presentation.http.routes.account import router as account_router
from app.presentation.http.routes.admin import router as admin_router
from app.presentation.http.routes.auth import router as auth_router
from app.presentation.http.routes.chat_reports import router as chat_reports_router
from app.presentation.http.routes.health import router as health_router
from app.presentation.http.routes.session import router as session_router
from app.presentation.ws.chat_endpoint import router as chat_ws_router
from app.shared.config import get_settings
from app.shared.errors import AppError


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _build_allowed_origins() -> list[str]:
    settings = get_settings()
    allowed_origins = {
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }

    for configured_url in filter(None, [settings.app_base_url, settings.frontend_base_url]):
        parsed = urlparse(configured_url)
        if not parsed.scheme or not parsed.netloc:
            continue

        allowed_origins.add(f"{parsed.scheme}://{parsed.netloc}")

        hostname = parsed.hostname or ""
        if hostname in {"localhost", "127.0.0.1"}:
            continue

        port_suffix = f":{parsed.port}" if parsed.port else ""
        alternate_hostname = hostname.removeprefix("www.") if hostname.startswith("www.") else f"www.{hostname}"

        for scheme in ("http", "https"):
            allowed_origins.add(f"{scheme}://{hostname}{port_suffix}")
            allowed_origins.add(f"{scheme}://{alternate_hostname}{port_suffix}")

    return sorted(allowed_origins)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    logger = logging.getLogger("app")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["x-request-id"] = request.state.request_id
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, error: AppError):
        logger.warning(error.message, extra={"request_id": _request_id(request)})
        return JSONResponse(
            status_code=error.status_code,
            content={
                "code": error.code,
                "message": error.message,
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, error: RequestValidationError):
        logger.warning("validation failed", extra={"request_id": _request_id(request)})
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": error.errors(),
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, error: Exception):
        logger.exception("unexpected error", extra={"request_id": _request_id(request)})
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
                "request_id": _request_id(request),
            },
        )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(account_router)
    app.include_router(admin_router)
    app.include_router(chat_reports_router)
    app.include_router(session_router)
    app.include_router(chat_ws_router)

    return app
