"""persist admin capability on accounts

Revision ID: 0004_account_admin_flag
Revises: 0003_admin_governance_foundation
Create Date: 2026-03-26 18:40:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_account_admin_flag"
down_revision: str | None = "0003_admin_governance_foundation"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_column("is_admin")
