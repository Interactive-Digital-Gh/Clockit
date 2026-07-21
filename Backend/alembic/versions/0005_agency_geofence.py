"""agency GPS geofence for clock-in verification

Revision ID: 0005_agency_geofence
Revises: 0004_attendance_qr
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_agency_geofence"
down_revision: Union[str, None] = "0004_attendance_qr"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("latitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("agencies", sa.Column("longitude", sa.Numeric(9, 6), nullable=True))
    op.add_column(
        "agencies",
        sa.Column("geofence_radius_m", sa.Integer(), nullable=True, server_default=sa.text("150")),
    )
    op.add_column(
        "attendance_records", sa.Column("clock_in_latitude", sa.Numeric(9, 6), nullable=True)
    )
    op.add_column(
        "attendance_records", sa.Column("clock_in_longitude", sa.Numeric(9, 6), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("attendance_records", "clock_in_longitude")
    op.drop_column("attendance_records", "clock_in_latitude")
    op.drop_column("agencies", "geofence_radius_m")
    op.drop_column("agencies", "longitude")
    op.drop_column("agencies", "latitude")
