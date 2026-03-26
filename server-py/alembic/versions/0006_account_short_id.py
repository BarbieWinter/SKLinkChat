"""add short_id to accounts

Revision ID: 0006_account_short_id
Revises: 0005_restriction_report_source
Create Date: 2026-03-26 21:20:00.000000
"""

from collections.abc import Sequence
from random import SystemRandom

from alembic import op
import sqlalchemy as sa


revision: str = "0006_account_short_id"
down_revision: str | None = "0005_restriction_report_source"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_RANDOM = SystemRandom()


def _generate_short_id(used: set[str]) -> str:
    while True:
        candidate = str(_RANDOM.randint(100000, 999999))
        if candidate not in used:
            return candidate


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("short_id", sa.String(length=6), nullable=True))

    connection = op.get_bind()
    accounts = sa.table(
        "accounts",
        sa.column("id", sa.String(length=36)),
        sa.column("short_id", sa.String(length=6)),
    )

    rows = connection.execute(sa.select(accounts.c.id, accounts.c.short_id)).all()
    used_short_ids = {str(row.short_id) for row in rows if row.short_id is not None}
    for row in rows:
        if row.short_id is not None:
            continue
        next_short_id = _generate_short_id(used_short_ids)
        used_short_ids.add(next_short_id)
        connection.execute(
            sa.update(accounts).where(accounts.c.id == row.id).values(short_id=next_short_id)
        )

    with op.batch_alter_table("accounts") as batch_op:
        batch_op.alter_column("short_id", existing_type=sa.String(length=6), nullable=False)
        batch_op.create_index("ux_accounts_short_id", ["short_id"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_index("ux_accounts_short_id")
        batch_op.drop_column("short_id")
