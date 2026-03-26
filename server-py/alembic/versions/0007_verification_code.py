"""verification code support

Revision ID: 0007_verification_code
Revises: 0006_account_short_id
Create Date: 2026-03-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_verification_code"
down_revision = "0006_account_short_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_verification_tokens",
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.drop_constraint(
        "email_verification_tokens_token_hash_key",
        "email_verification_tokens",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "email_verification_tokens_token_hash_key",
        "email_verification_tokens",
        ["token_hash"],
    )
    op.drop_column("email_verification_tokens", "attempts")
