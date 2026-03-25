from __future__ import annotations

import os
import re
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://sklinkchat:sklinkchat@127.0.0.1:5432/sklinkchat_test"
DEFAULT_ADMIN_DATABASE_URL = "postgresql+psycopg://postgres@127.0.0.1:5432/postgres"

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def get_test_database_url() -> str:
    return os.getenv("SERVER_PY_TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


def make_temporary_database_url(prefix: str) -> str:
    base_url = make_url(get_test_database_url())
    database_name = f"{prefix}_{uuid4().hex}"
    return base_url.set(database=database_name).render_as_string(hide_password=False)


def ensure_database_exists(database_url: str) -> None:
    url = make_url(database_url)
    _validate_identifier(url.database, "database name")
    _validate_identifier(url.username, "database owner")

    admin_engine = create_engine(_admin_url_for(database_url), isolation_level="AUTOCOMMIT", future=True)
    try:
        with admin_engine.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": url.database},
            ).scalar_one_or_none()
            if exists is None:
                connection.exec_driver_sql(f'CREATE DATABASE "{url.database}" OWNER "{url.username}"')
    finally:
        admin_engine.dispose()


def drop_database(database_url: str) -> None:
    url = make_url(database_url)
    _validate_identifier(url.database, "database name")

    admin_engine = create_engine(_admin_url_for(database_url), isolation_level="AUTOCOMMIT", future=True)
    try:
        with admin_engine.connect() as connection:
            connection.execute(
                text(
                    """
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = :database_name
                      AND pid <> pg_backend_pid()
                    """
                ),
                {"database_name": url.database},
            )
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": url.database},
            ).scalar_one_or_none()
            if exists is not None:
                connection.exec_driver_sql(f'DROP DATABASE "{url.database}"')
    finally:
        admin_engine.dispose()


def _admin_url_for(database_url: str) -> URL:
    configured_url = os.getenv("SERVER_PY_TEST_ADMIN_DATABASE_URL")
    if configured_url:
        return make_url(configured_url)

    database_url_obj = make_url(database_url)
    return database_url_obj.set(database="postgres", username="postgres", password=None)


def _validate_identifier(value: str | None, label: str) -> None:
    if value is None or not _IDENTIFIER_RE.fullmatch(value):
        raise RuntimeError(f"Unsupported PostgreSQL {label}: {value!r}")
