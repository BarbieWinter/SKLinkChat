from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from app.shared.config import get_settings
from tests.postgres_utils import drop_database, ensure_database_exists, make_temporary_database_url


def test_alembic_upgrade_head_exposes_hardened_schema(monkeypatch):
    database_url = make_temporary_database_url("sklinkchat_migration")
    ensure_database_exists(database_url)
    monkeypatch.setenv("SERVER_PY_DATABASE_URL", database_url)
    get_settings.cache_clear()

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    engine = None
    try:
        command.upgrade(config, "head")

        engine = create_engine(database_url)
        inspector = inspect(engine)

        assert "chat_reports" in inspector.get_table_names()
        assert "language" not in {column["name"] for column in inspector.get_columns("accounts")}
        assert not any(table_name.startswith("forum_") for table_name in inspector.get_table_names())

        account_columns = {column["name"] for column in inspector.get_columns("accounts")}
        assert {
            "is_admin",
            "short_id",
            "chat_access_restricted_at",
            "chat_access_restriction_reason",
            "chat_access_restriction_report_id",
        } <= account_columns
        account_index_names = {index["name"] for index in inspector.get_indexes("accounts")}
        assert "ux_accounts_short_id" in account_index_names

        chat_session_columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
        assert {"display_name_snapshot", "status", "close_reason"} <= chat_session_columns

        chat_match_columns = {column["name"] for column in inspector.get_columns("chat_matches")}
        assert {"end_reason"} <= chat_match_columns

        chat_message_columns = {column["name"] for column in inspector.get_columns("chat_messages")}
        assert {
            "chat_match_id",
            "client_message_id",
            "message_type",
            "sender_display_name_snapshot",
            "body",
        } <= chat_message_columns
        assert "match_id" not in chat_message_columns
        assert "content" not in chat_message_columns

        chat_report_columns = {column["name"] for column in inspector.get_columns("chat_reports")}
        assert {
            "reporter_account_id",
            "chat_match_id",
            "reported_chat_session_id",
            "reason",
            "details",
            "status",
            "reviewed_by_account_id",
            "review_note",
        } <= chat_report_columns

        index_names = {index["name"] for index in inspector.get_indexes("chat_sessions")}
        assert "ux_chat_sessions_one_active_per_account" in index_names

        match_index_names = {index["name"] for index in inspector.get_indexes("chat_matches")}
        assert "ux_chat_matches_active_left" in match_index_names
        assert "ux_chat_matches_active_right" in match_index_names

        message_index_names = {index["name"] for index in inspector.get_indexes("chat_messages")}
        assert "ux_chat_messages_match_client_message_id" in message_index_names
    finally:
        if engine is not None:
            engine.dispose()
        get_settings.cache_clear()
        drop_database(database_url)
