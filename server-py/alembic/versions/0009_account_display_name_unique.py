"""make display_name unique

Revision ID: 0009_account_display_name_unique
Revises: 0008_account_gender
Create Date: 2026-04-07 15:30:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009_account_display_name_unique"
down_revision: str | None = "0008_account_gender"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.create_unique_constraint("uq_accounts_display_name", ["display_name"])


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_constraint("uq_accounts_display_name", type_="unique")
