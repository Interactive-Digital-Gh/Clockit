"""rotating attendance QR tokens

Revision ID: 0004_attendance_qr
Revises: 0003_employee_role
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_attendance_qr"
down_revision: Union[str, None] = "0003_employee_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_qr_tokens",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("token", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("rotated_by", sa.String(), nullable=True),
    )
    # Seed with the token already printed on attendance-qr-code.png and baked
    # into the mobile app's offline fallback, so nothing breaks on deploy.
    op.execute(
        "INSERT INTO attendance_qr_tokens (token, rotated_by) "
        "VALUES ('clockit:attendance:interactive-digital:v1', 'seed')"
    )


def downgrade() -> None:
    op.drop_table("attendance_qr_tokens")
