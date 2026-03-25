"""password reset tokens

Revision ID: 0003_password_reset_tokens
Revises: 0002_post_auth_hardening
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_password_reset_tokens"
down_revision: str | None = "0002_post_auth_hardening"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)",
            name="ck_password_reset_tokens_not_both_consumed_and_revoked",
        ),
    )
    op.create_index("ix_password_reset_tokens_account_id_created_at", "password_reset_tokens", ["account_id", "created_at"])
    op.create_index("ix_password_reset_tokens_account_id", "password_reset_tokens", ["account_id"])


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
