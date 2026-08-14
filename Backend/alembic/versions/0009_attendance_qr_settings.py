"""attendance QR auto-rotation settings

Revision ID: 0009_attendance_qr_settings
Revises: 0008_profile_password
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_attendance_qr_settings"
down_revision: Union[str, None] = "0008_profile_password"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_qr_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("rotation_minutes", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    # Singleton row. rotation_minutes=NULL preserves today's manual-only
    # rotation until an admin sets an interval.
    op.execute("INSERT INTO attendance_qr_settings (rotation_minutes) VALUES (NULL)")


def downgrade() -> None:
    op.drop_table("attendance_qr_settings")
