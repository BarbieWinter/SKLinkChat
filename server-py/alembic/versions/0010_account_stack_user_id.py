"""add stack user binding

Revision ID: 0010_account_stack_user_id
Revises: 0009_account_display_name_unique
Create Date: 2026-04-08 14:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_account_stack_user_id"
down_revision: str | None = "0009_account_display_name_unique"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("stack_user_id", sa.String(length=128), nullable=True))
        batch_op.create_index("ux_accounts_stack_user_id", ["stack_user_id"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_index("ux_accounts_stack_user_id")
        batch_op.drop_column("stack_user_id")
