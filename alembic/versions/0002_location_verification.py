"""attendance location verification fields

Revision ID: 0002_location_verification
Revises: 0001_initial
Create Date: 2026-07-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_location_verification"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendance_records",
        sa.Column("location_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "attendance_records",
        sa.Column("verification_source", sa.String(), server_default=sa.text("'off_site'"), nullable=False),
    )
    op.add_column("attendance_records", sa.Column("clock_in_public_ip", sa.String(), nullable=True))
    op.add_column("attendance_records", sa.Column("clock_in_local_ip", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_records", "clock_in_local_ip")
    op.drop_column("attendance_records", "clock_in_public_ip")
    op.drop_column("attendance_records", "verification_source")
    op.drop_column("attendance_records", "location_verified")
