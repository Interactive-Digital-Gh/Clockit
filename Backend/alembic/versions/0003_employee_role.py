"""employee role: personal-view dashboard users

Revision ID: 0003_employee_role
Revises: 0002_location_verification
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_employee_role"
down_revision: Union[str, None] = "0002_location_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("profiles_role_check", "profiles", type_="check")
    op.create_check_constraint(
        "profiles_role_check",
        "profiles",
        "role in ('super_admin', 'it', 'hr', 'front_desk', 'employee')",
    )
    # New sign-ups start as personal-view employees, not front desk.
    op.alter_column("profiles", "role", server_default=sa.text("'employee'"))


def downgrade() -> None:
    op.execute("UPDATE profiles SET role = 'front_desk' WHERE role = 'employee'")
    op.drop_constraint("profiles_role_check", "profiles", type_="check")
    op.create_check_constraint(
        "profiles_role_check",
        "profiles",
        "role in ('super_admin', 'it', 'hr', 'front_desk')",
    )
    op.alter_column("profiles", "role", server_default=sa.text("'front_desk'"))
