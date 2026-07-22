"""Attendance business logic — the single source of truth for clock rules.

These decisions used to live in the mobile client (config/attendance.ts,
attendanceService.ts) where they were trusted and spoofable. They now run
server-side.
"""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AttendanceRecord, AttendanceSession

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


def get_today_record(db: Session, employee_id) -> AttendanceRecord | None:
    return db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.date == today(),
        )
    )


def get_open_session(db: Session, attendance_record_id) -> AttendanceSession | None:
    return db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.attendance_record_id == attendance_record_id,
            AttendanceSession.clock_out_time.is_(None),
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
    """Idempotent while already on-site: returns the record unchanged if a
    session is already open. Otherwise opens a new session — the first one of
    the day creates today's AttendanceRecord; later ones are re-entries after
    a clock-out (leaving and coming back), tracked under the same day's
    record. Never blocks — the location fields record where it happened."""
    now = datetime.now(timezone.utc)
    record = get_today_record(db, employee_id)

    if record is not None:
        if get_open_session(db, record.id) is not None:
            return record  # already clocked in — no-op

        db.add(
            AttendanceSession(
                attendance_record_id=record.id,
                clock_in_time=now,
                verification_method=verification_method,
                location_verified=location_verified,
                verification_source=verification_source,
                clock_in_public_ip=public_ip,
                clock_in_local_ip=local_ip,
                clock_in_latitude=latitude,
                clock_in_longitude=longitude,
            )
        )
        record.clock_out_time = None  # back on-site
        db.commit()
        db.refresh(record)
        return record

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
    db.flush()  # assign record.id for the session FK
    db.add(
        AttendanceSession(
            attendance_record_id=record.id,
            clock_in_time=now,
            verification_method=verification_method,
            location_verified=location_verified,
            verification_source=verification_source,
            clock_in_public_ip=public_ip,
            clock_in_local_ip=local_ip,
            clock_in_latitude=latitude,
            clock_in_longitude=longitude,
        )
    )
    db.commit()
    db.refresh(record)
    return record


def clock_out(db: Session, employee_id) -> AttendanceRecord:
    """Closes today's open session and recomputes total_hours across all of
    today's sessions. Raises if nothing is currently open."""
    record = get_today_record(db, employee_id)
    if record is None:
        raise ValueError("No open clock-in found for today.")

    sessions = db.scalars(
        select(AttendanceSession)
        .where(AttendanceSession.attendance_record_id == record.id)
        .order_by(AttendanceSession.clock_in_time)
    ).all()
    open_session = next((s for s in sessions if s.clock_out_time is None), None)
    if open_session is None:
        raise ValueError("No open clock-in found for today.")

    now = datetime.now(timezone.utc)
    open_session.clock_out_time = now
    record.total_hours = round(
        sum(
            (s.clock_out_time - s.clock_in_time).total_seconds()
            for s in sessions
            if s.clock_out_time is not None
        )
        / 3600,
        2,
    )
    record.clock_out_time = now
    db.commit()
    db.refresh(record)
    return record
