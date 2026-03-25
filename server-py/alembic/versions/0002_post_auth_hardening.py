"""post auth hardening

Revision ID: 0002_post_auth_hardening
Revises: 0001_auth_foundation
Create Date: 2026-03-25 20:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0002_post_auth_hardening"
down_revision: str | None = "0001_auth_foundation"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.add_column(sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_check_constraint(
            "ck_email_verification_tokens_not_both_consumed_and_revoked",
            "NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)",
        )

    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.add_column(sa.Column("display_name_snapshot", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(length=16), nullable=True, server_default="active"))
        batch_op.add_column(sa.Column("close_reason", sa.String(length=32), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE chat_sessions
            SET display_name_snapshot = accounts.display_name
            FROM accounts
            WHERE accounts.id = chat_sessions.account_id
            """
        )
    )
    op.execute(sa.text("UPDATE chat_sessions SET status = 'closed' WHERE closed_at IS NOT NULL"))
    op.execute(sa.text("UPDATE chat_sessions SET status = 'active' WHERE closed_at IS NULL"))
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY account_id
                        ORDER BY last_seen_at DESC, created_at DESC, id DESC
                    ) AS rn
                FROM chat_sessions
                WHERE status = 'active'
            )
            UPDATE chat_sessions
            SET
                status = 'closed',
                closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
                close_reason = COALESCE(close_reason, 'superseded')
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
            """
        )
    )

    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.alter_column("display_name_snapshot", existing_type=sa.String(length=80), nullable=False)
        batch_op.alter_column("status", existing_type=sa.String(length=16), nullable=False, server_default=None)
        batch_op.create_check_constraint("ck_chat_sessions_status", "status IN ('active', 'closed', 'expired')")
        batch_op.create_check_constraint(
            "ck_chat_sessions_display_name_nonempty",
            "trim(display_name_snapshot) <> ''",
        )
        batch_op.create_check_constraint(
            "ck_chat_sessions_closed_at_consistency",
            "((status = 'active' AND closed_at IS NULL) OR (status IN ('closed', 'expired') AND closed_at IS NOT NULL))",
        )
    op.create_index(
        "ux_chat_sessions_one_active_per_account",
        "chat_sessions",
        ["account_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    with op.batch_alter_table("chat_matches") as batch_op:
        batch_op.add_column(sa.Column("end_reason", sa.String(length=32), nullable=True))
        batch_op.create_check_constraint("ck_chat_matches_distinct_sides", "left_chat_session_id <> right_chat_session_id")
        batch_op.create_check_constraint(
            "ck_chat_matches_ended_after_started",
            "ended_at IS NULL OR ended_at >= started_at",
        )

    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY chat_session_id
                        ORDER BY started_at DESC, id DESC
                    ) AS rn
                FROM (
                    SELECT id, left_chat_session_id AS chat_session_id, started_at
                    FROM chat_matches
                    WHERE ended_at IS NULL
                    UNION ALL
                    SELECT id, right_chat_session_id AS chat_session_id, started_at
                    FROM chat_matches
                    WHERE ended_at IS NULL
                ) active_matches
            ),
            to_close AS (
                SELECT DISTINCT id
                FROM ranked
                WHERE rn > 1
            )
            UPDATE chat_matches
            SET
                ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
                end_reason = COALESCE(end_reason, 'superseded')
            WHERE id IN (SELECT id FROM to_close)
            """
        )
    )
    op.drop_index("ix_chat_matches_left_chat_session_id", table_name="chat_matches")
    op.drop_index("ix_chat_matches_right_chat_session_id", table_name="chat_matches")
    op.create_index(
        "ix_chat_matches_left_chat_session_id_started_at",
        "chat_matches",
        ["left_chat_session_id", "started_at"],
    )
    op.create_index(
        "ix_chat_matches_right_chat_session_id_started_at",
        "chat_matches",
        ["right_chat_session_id", "started_at"],
    )
    op.create_index("ix_chat_matches_started_at", "chat_matches", ["started_at"])
    op.create_index(
        "ux_chat_matches_active_left",
        "chat_matches",
        ["left_chat_session_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )
    op.create_index(
        "ux_chat_matches_active_right",
        "chat_matches",
        ["right_chat_session_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )

    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.alter_column("match_id", new_column_name="chat_match_id")
        batch_op.alter_column("content", new_column_name="body")
        batch_op.add_column(sa.Column("client_message_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("message_type", sa.String(length=16), nullable=True, server_default="text"))
        batch_op.add_column(sa.Column("sender_display_name_snapshot", sa.String(length=80), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE chat_messages
            SET sender_display_name_snapshot = chat_sessions.display_name_snapshot
            FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.sender_chat_session_id
            """
        )
    )

    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.alter_column("message_type", existing_type=sa.String(length=16), nullable=False, server_default=None)
        batch_op.alter_column(
            "sender_display_name_snapshot",
            existing_type=sa.String(length=80),
            nullable=False,
        )
        batch_op.create_check_constraint("ck_chat_messages_message_type", "message_type IN ('text', 'system')")
        batch_op.create_check_constraint(
            "ck_chat_messages_sender_display_name_nonempty",
            "trim(sender_display_name_snapshot) <> ''",
        )
        batch_op.create_check_constraint("ck_chat_messages_body_nonempty", "trim(body) <> ''")

    op.drop_index("ix_chat_messages_match_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_match_id_created_at", table_name="chat_messages")
    op.create_index(
        "ix_chat_messages_chat_match_id_created_at",
        "chat_messages",
        ["chat_match_id", "created_at"],
    )
    op.create_index(
        "ix_chat_messages_sender_chat_session_id_created_at",
        "chat_messages",
        ["sender_chat_session_id", "created_at"],
    )
    op.create_index(
        "ux_chat_messages_match_client_message_id",
        "chat_messages",
        ["chat_match_id", "client_message_id"],
        unique=True,
        postgresql_where=sa.text("client_message_id IS NOT NULL"),
    )

    op.create_table(
        "chat_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("reporter_account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("chat_match_id", sa.String(length=36), sa.ForeignKey("chat_matches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "reported_chat_session_id",
            sa.String(length=36),
            sa.ForeignKey("chat_sessions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "reason IN ('harassment', 'sexual_content', 'spam', 'hate_speech', 'other')",
            name="ck_chat_reports_reason",
        ),
        sa.CheckConstraint(
            "(reason <> 'other' OR (details IS NOT NULL AND trim(details) <> ''))",
            name="ck_chat_reports_other_requires_details",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'reviewed', 'dismissed', 'actioned')",
            name="ck_chat_reports_status",
        ),
        sa.CheckConstraint(
            "((status = 'open' AND reviewed_at IS NULL) OR (status IN ('reviewed', 'dismissed', 'actioned') AND reviewed_at IS NOT NULL))",
            name="ck_chat_reports_reviewed_at_consistency",
        ),
    )
    op.create_index(
        "ix_chat_reports_reporter_account_id_created_at",
        "chat_reports",
        ["reporter_account_id", "created_at"],
    )
    op.create_index(
        "ix_chat_reports_chat_match_id_created_at",
        "chat_reports",
        ["chat_match_id", "created_at"],
    )
    op.create_index(
        "ix_chat_reports_reported_chat_session_id_created_at",
        "chat_reports",
        ["reported_chat_session_id", "created_at"],
    )
    op.create_index("ix_chat_reports_status_created_at", "chat_reports", ["status", "created_at"])


def downgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.drop_constraint("ck_email_verification_tokens_not_both_consumed_and_revoked", type_="check")
        batch_op.drop_column("revoked_at")

    op.drop_index("ix_chat_reports_status_created_at", table_name="chat_reports")
    op.drop_index("ix_chat_reports_reported_chat_session_id_created_at", table_name="chat_reports")
    op.drop_index("ix_chat_reports_chat_match_id_created_at", table_name="chat_reports")
    op.drop_index("ix_chat_reports_reporter_account_id_created_at", table_name="chat_reports")
    op.drop_table("chat_reports")

    op.drop_index("ux_chat_messages_match_client_message_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_sender_chat_session_id_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_chat_match_id_created_at", table_name="chat_messages")
    op.create_index("ix_chat_messages_match_id", "chat_messages", ["chat_match_id"])
    op.create_index("ix_chat_messages_match_id_created_at", "chat_messages", ["chat_match_id", "created_at"])
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.drop_constraint("ck_chat_messages_body_nonempty", type_="check")
        batch_op.drop_constraint("ck_chat_messages_sender_display_name_nonempty", type_="check")
        batch_op.drop_constraint("ck_chat_messages_message_type", type_="check")
        batch_op.drop_column("sender_display_name_snapshot")
        batch_op.drop_column("message_type")
        batch_op.drop_column("client_message_id")
        batch_op.alter_column("chat_match_id", new_column_name="match_id")
        batch_op.alter_column("body", new_column_name="content")

    op.drop_index("ux_chat_matches_active_right", table_name="chat_matches")
    op.drop_index("ux_chat_matches_active_left", table_name="chat_matches")
    op.drop_index("ix_chat_matches_started_at", table_name="chat_matches")
    op.drop_index("ix_chat_matches_right_chat_session_id_started_at", table_name="chat_matches")
    op.drop_index("ix_chat_matches_left_chat_session_id_started_at", table_name="chat_matches")
    op.create_index("ix_chat_matches_left_chat_session_id", "chat_matches", ["left_chat_session_id"])
    op.create_index("ix_chat_matches_right_chat_session_id", "chat_matches", ["right_chat_session_id"])
    with op.batch_alter_table("chat_matches") as batch_op:
        batch_op.drop_constraint("ck_chat_matches_ended_after_started", type_="check")
        batch_op.drop_constraint("ck_chat_matches_distinct_sides", type_="check")
        batch_op.drop_column("end_reason")

    op.drop_index("ux_chat_sessions_one_active_per_account", table_name="chat_sessions")
    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.drop_constraint("ck_chat_sessions_closed_at_consistency", type_="check")
        batch_op.drop_constraint("ck_chat_sessions_display_name_nonempty", type_="check")
        batch_op.drop_constraint("ck_chat_sessions_status", type_="check")
        batch_op.drop_column("close_reason")
        batch_op.drop_column("status")
        batch_op.drop_column("display_name_snapshot")
