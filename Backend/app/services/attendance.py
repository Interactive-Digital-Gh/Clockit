"""Attendance business logic — the single source of truth for clock rules.

These decisions used to live in the mobile client (config/attendance.ts,
attendanceService.ts) where they were trusted and spoofable. They now run
server-side.
"""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AttendanceRecord

settings = get_settings()


def today() -> date:
    return datetime.now(timezone.utc).date()


def is_late(clock_in: datetime) -> bool:
    """True if clock-in is past shift start + grace (local wall-clock of the ts)."""
    cutoff = clock_in.replace(
        hour=settings.shift_start_hour,
        minute=settings.shift_start_minute + settings.shift_grace_minutes,
        second=0,
        microsecond=0,
    )
    return clock_in > cutoff


def compute_total_hours(clock_in: datetime, clock_out: datetime) -> float:
    return round((clock_out - clock_in).total_seconds() / 3600, 2)


def get_today_record(db: Session, employee_id) -> AttendanceRecord | None:
    return db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today(),
        )
    )


def clock_in(
    db: Session,
    employee_id,
    *,
    location_verified: bool = False,
    verification_source: str = "off_site",
    public_ip: str | None = None,
    local_ip: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    verification_method: str = "manual",
) -> AttendanceRecord:
    """Idempotent: returns the existing open record if already clocked in today.
    Never blocks — the location fields record where the clock-in happened."""
    existing = get_today_record(db, employee_id)
    if existing is not None:
        return existing

    now = datetime.now(timezone.utc)
    record = AttendanceRecord(
        employee_id=employee_id,
        date=today(),
        clock_in_time=now,
        status="late" if is_late(now) else "present",
        verification_method=verification_method,
        location_verified=location_verified,
        verification_source=verification_source,
        clock_in_public_ip=public_ip,
        clock_in_local_ip=local_ip,
        clock_in_latitude=latitude,
        clock_in_longitude=longitude,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def clock_out(db: Session, employee_id) -> AttendanceRecord:
    """Closes today's open record and computes total_hours. Raises if none open."""
    record = get_today_record(db, employee_id)
    if record is None or record.clock_out_time is not None:
        raise ValueError("No open clock-in found for today.")

    now = datetime.now(timezone.utc)
    record.clock_out_time = now
    record.total_hours = compute_total_hours(record.clock_in_time, now)
    db.commit()
    db.refresh(record)
    return record
