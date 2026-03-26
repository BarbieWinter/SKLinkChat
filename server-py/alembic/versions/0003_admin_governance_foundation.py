"""admin governance foundation

Revision ID: 0003_admin_governance_foundation
Revises: 0002_post_auth_hardening
Create Date: 2026-03-26 09:45:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_admin_governance_foundation"
down_revision: str | None = "0003_password_reset_tokens"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("chat_access_restricted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("chat_access_restriction_reason", sa.Text(), nullable=True))
        batch_op.create_check_constraint(
            "ck_accounts_chat_access_restriction_consistency",
            "((chat_access_restricted_at IS NULL AND chat_access_restriction_reason IS NULL) "
            "OR (chat_access_restricted_at IS NOT NULL "
            "AND chat_access_restriction_reason IS NOT NULL "
            "AND trim(chat_access_restriction_reason) <> ''))",
        )

    with op.batch_alter_table("chat_reports") as batch_op:
        batch_op.add_column(
            sa.Column(
                "reviewed_by_account_id",
                sa.String(length=36),
                sa.ForeignKey("accounts.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("review_note", sa.Text(), nullable=True))
        batch_op.drop_constraint("ck_chat_reports_reviewed_at_consistency", type_="check")
        batch_op.create_check_constraint(
            "ck_chat_reports_reviewed_at_consistency",
            "((status = 'open' AND reviewed_at IS NULL AND reviewed_by_account_id IS NULL AND review_note IS NULL) "
            "OR (status IN ('reviewed', 'dismissed', 'actioned') "
            "AND reviewed_at IS NOT NULL "
            "AND reviewed_by_account_id IS NOT NULL "
            "AND review_note IS NOT NULL "
            "AND trim(review_note) <> ''))",
        )


def downgrade() -> None:
    with op.batch_alter_table("chat_reports") as batch_op:
        batch_op.drop_constraint("ck_chat_reports_reviewed_at_consistency", type_="check")
        batch_op.create_check_constraint(
            "ck_chat_reports_reviewed_at_consistency",
            "((status = 'open' AND reviewed_at IS NULL) "
            "OR (status IN ('reviewed', 'dismissed', 'actioned') AND reviewed_at IS NOT NULL))",
        )
        batch_op.drop_column("review_note")
        batch_op.drop_column("reviewed_by_account_id")

    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_constraint("ck_accounts_chat_access_restriction_consistency", type_="check")
        batch_op.drop_column("chat_access_restriction_reason")
        batch_op.drop_column("chat_access_restricted_at")
