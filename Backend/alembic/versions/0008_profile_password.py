"""optional password hash for profiles

Revision ID: 0008_profile_password
Revises: 0007_attendance_sessions
Create Date: 2026-08-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_profile_password"
down_revision: Union[str, None] = "0007_attendance_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("password_hash", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "password_hash")
