"""Store QR rotation in seconds while preserving configured durations."""
from alembic import op
import sqlalchemy as sa

revision = "0010_qr_rotation_seconds"
down_revision = "0009_attendance_qr_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("attendance_qr_settings", "rotation_minutes", new_column_name="rotation_seconds", existing_type=sa.Integer())
    op.execute("UPDATE attendance_qr_settings SET rotation_seconds = rotation_seconds * 60 WHERE rotation_seconds IS NOT NULL")


def downgrade():
    op.execute("UPDATE attendance_qr_settings SET rotation_seconds = GREATEST(1, CEIL(rotation_seconds / 60.0)::integer) WHERE rotation_seconds IS NOT NULL")
    op.alter_column("attendance_qr_settings", "rotation_seconds", new_column_name="rotation_minutes", existing_type=sa.Integer())
