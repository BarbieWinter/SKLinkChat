"""store current restriction source report

Revision ID: 0005_restriction_report_source
Revises: 0004_account_admin_flag
Create Date: 2026-03-26 19:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005_restriction_report_source"
down_revision: str | None = "0004_account_admin_flag"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_constraint("ck_accounts_chat_access_restriction_consistency", type_="check")
        batch_op.add_column(sa.Column("chat_access_restriction_report_id", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "ck_accounts_chat_access_restriction_consistency",
            "((chat_access_restricted_at IS NULL "
            "AND chat_access_restriction_reason IS NULL "
            "AND chat_access_restriction_report_id IS NULL) "
            "OR (chat_access_restricted_at IS NOT NULL "
            "AND chat_access_restriction_reason IS NOT NULL "
            "AND trim(chat_access_restriction_reason) <> ''))",
        )


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_constraint("ck_accounts_chat_access_restriction_consistency", type_="check")
        batch_op.create_check_constraint(
            "ck_accounts_chat_access_restriction_consistency",
            "((chat_access_restricted_at IS NULL AND chat_access_restriction_reason IS NULL) "
            "OR (chat_access_restricted_at IS NOT NULL "
            "AND chat_access_restriction_reason IS NOT NULL "
            "AND trim(chat_access_restriction_reason) <> ''))",
        )
        batch_op.drop_column("chat_access_restriction_report_id")
