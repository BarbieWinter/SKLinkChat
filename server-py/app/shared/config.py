from functools import lru_cache
from typing import TypedDict

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SERVER_PY_", extra="ignore")

    app_name: str = "SKLinkChat Python Backend"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    reconnect_window_seconds: int = 180
    partner_disconnect_grace_seconds: float = 1.0
    redis_url: str = Field(...)


class SettingsInitKwargs(TypedDict, total=False):
    app_name: str
    environment: str
    host: str
    port: int
    log_level: str
    reconnect_window_seconds: int
    partner_disconnect_grace_seconds: float
    redis_url: str


@lru_cache
def get_settings() -> Settings:
    init_kwargs: SettingsInitKwargs = {}
    return Settings(**init_kwargs)
