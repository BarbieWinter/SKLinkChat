"""auth foundation

Revision ID: 0001_auth_foundation
Revises:
Create Date: 2026-03-25 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_auth_foundation"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "account_interests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interest", sa.String(length=80), nullable=False),
        sa.UniqueConstraint("account_id", "interest", name="uq_account_interest"),
    )
    op.create_index("ix_account_interests_account_id", "account_interests", ["account_id"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_sessions_account_id", "auth_sessions", ["account_id"])
    op.create_index("ix_auth_sessions_account_id_expires_at", "auth_sessions", ["account_id", "expires_at"])

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_verification_tokens_account_id", "email_verification_tokens", ["account_id"])
    op.create_index(
        "ix_email_verification_tokens_account_id_created_at",
        "email_verification_tokens",
        ["account_id", "created_at"],
    )

    op.create_table(
        "registration_risk_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("outcome", sa.String(length=80), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_registration_risk_events_account_id", "registration_risk_events", ["account_id"])

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_chat_sessions_account_id", "chat_sessions", ["account_id"])
    op.create_index("ix_chat_sessions_account_id_created_at", "chat_sessions", ["account_id", "created_at"])

    op.create_table(
        "chat_matches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("left_chat_session_id", sa.String(length=36), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("right_chat_session_id", sa.String(length=36), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_chat_matches_left_chat_session_id", "chat_matches", ["left_chat_session_id"])
    op.create_index("ix_chat_matches_right_chat_session_id", "chat_matches", ["right_chat_session_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("match_id", sa.String(length=36), sa.ForeignKey("chat_matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "sender_chat_session_id",
            sa.String(length=36),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_messages_match_id", "chat_messages", ["match_id"])
    op.create_index("ix_chat_messages_match_id_created_at", "chat_messages", ["match_id", "created_at"])
    op.create_index("ix_chat_messages_expires_at", "chat_messages", ["expires_at"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("chat_session_id", sa.String(length=36), sa.ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_account_id", "audit_events", ["account_id"])
    op.create_index("ix_audit_events_chat_session_id", "audit_events", ["chat_session_id"])
    op.create_index("ix_audit_events_expires_at", "audit_events", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_expires_at", table_name="audit_events")
    op.drop_index("ix_audit_events_chat_session_id", table_name="audit_events")
    op.drop_index("ix_audit_events_account_id", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_index("ix_chat_messages_expires_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_match_id_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_match_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_chat_matches_right_chat_session_id", table_name="chat_matches")
    op.drop_index("ix_chat_matches_left_chat_session_id", table_name="chat_matches")
    op.drop_table("chat_matches")

    op.drop_index("ix_chat_sessions_account_id_created_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_account_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")

    op.drop_index("ix_registration_risk_events_account_id", table_name="registration_risk_events")
    op.drop_table("registration_risk_events")

    op.drop_index("ix_email_verification_tokens_account_id_created_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_account_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    op.drop_index("ix_auth_sessions_account_id_expires_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_account_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")

    op.drop_index("ix_account_interests_account_id", table_name="account_interests")
    op.drop_table("account_interests")

    op.drop_table("accounts")
