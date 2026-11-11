"""Optional recurring employee work schedules."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_employee_work_schedule"
down_revision = "0010_qr_rotation_seconds"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('employees', sa.Column('work_schedule', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('employees', 'work_schedule')
