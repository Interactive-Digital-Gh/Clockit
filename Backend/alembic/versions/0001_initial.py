"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("agency_code", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("network_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("email_domains", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("role", sa.String(), server_default=sa.text("'front_desk'"), nullable=False),
        sa.Column("google_sub", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("google_sub"),
        sa.CheckConstraint("role in ('super_admin', 'it', 'hr', 'front_desk')", name="profiles_role_check"),
    )

    op.create_table(
        "employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("emp_id", sa.String(), nullable=True),
        sa.Column("job_title", sa.String(), nullable=True),
        sa.Column("employment_type", sa.String(), nullable=True),
        sa.Column("date_join", sa.Date(), nullable=True),
        sa.Column("agency_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("google_sub", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("google_sub"),
    )
    op.create_index("ix_employees_email", "employees", ["email"])

    op.create_table(
        "attendance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("clock_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("clock_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'present'"), nullable=False),
        sa.Column("total_hours", sa.Numeric(6, 2), nullable=True),
        sa.Column("verification_method", sa.String(), server_default=sa.text("'manual'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "clock_out_time IS NULL OR clock_out_time >= clock_in_time",
            name="attendance_clockout_after_clockin",
        ),
        # One attendance row per employee per day.
        sa.UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )
    op.create_index("ix_attendance_date", "attendance_records", ["date"])


def downgrade() -> None:
    op.drop_index("ix_attendance_date", table_name="attendance_records")
    op.drop_table("attendance_records")
    op.drop_index("ix_employees_email", table_name="employees")
    op.drop_table("employees")
    op.drop_table("profiles")
    op.drop_table("agencies")
