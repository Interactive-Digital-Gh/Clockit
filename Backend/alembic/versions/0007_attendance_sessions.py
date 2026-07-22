"""attendance sessions — multiple clock-in/out cycles per day

Revision ID: 0007_attendance_sessions
Revises: 0006_notifications
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_attendance_sessions"
down_revision: Union[str, None] = "0006_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "attendance_record_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("attendance_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("clock_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("clock_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_method", sa.String(), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("location_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verification_source", sa.String(), nullable=False, server_default=sa.text("'off_site'")),
        sa.Column("clock_in_public_ip", sa.String(), nullable=True),
        sa.Column("clock_in_local_ip", sa.String(), nullable=True),
        sa.Column("clock_in_latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("clock_in_longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint(
            "clock_out_time IS NULL OR clock_out_time >= clock_in_time",
            name="attendance_session_clockout_after_clockin",
        ),
    )

    # Backfill: every existing attendance_records row becomes its day's first
    # (and, until now, only) session — otherwise clock_out() would find no
    # open session to close for anyone already mid-day when this deploys.
    op.execute(
        """
        INSERT INTO attendance_sessions (
            id, attendance_record_id, clock_in_time, clock_out_time,
            verification_method, location_verified, verification_source,
            clock_in_public_ip, clock_in_local_ip, clock_in_latitude, clock_in_longitude,
            created_at
        )
        SELECT
            gen_random_uuid(), id, clock_in_time, clock_out_time,
            verification_method, location_verified, verification_source,
            clock_in_public_ip, clock_in_local_ip, clock_in_latitude, clock_in_longitude,
            created_at
        FROM attendance_records
        """
    )


def downgrade() -> None:
    op.drop_table("attendance_sessions")
