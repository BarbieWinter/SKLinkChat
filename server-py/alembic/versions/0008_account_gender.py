"""add gender to accounts

Revision ID: 0008_account_gender
Revises: 0007_verification_code
Create Date: 2026-04-07 00:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_account_gender"
down_revision: str | None = "0007_verification_code"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("gender", sa.String(length=16), server_default="unknown", nullable=False))
        batch_op.create_check_constraint("ck_accounts_gender", "gender IN ('male', 'female', 'unknown')")


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_constraint("ck_accounts_gender", type_="check")
        batch_op.drop_column("gender")
