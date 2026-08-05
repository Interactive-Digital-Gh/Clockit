"""Attendance business logic — the single source of truth for clock rules.

These decisions used to live in the mobile client (config/attendance.ts,
attendanceService.ts) where they were trusted and spoofable. They now run
server-side.
"""

from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Agency, AttendanceRecord, AttendanceSession, Employee, Profile

settings = get_settings()


def today() -> date:
    return datetime.now(timezone.utc).date()


def find_agency_by_email_domain(db: Session, email: str) -> Agency | None:
    """Match a new sign-up's email domain against each active agency's
    configured `email_domains` (e.g. HQ -> ["interactivedigital.com"]) so
    self-registration can default to the right office instead of leaving
    the employee unassigned — which silently disables GPS/subnet clock-in
    verification for them (classify_location never runs without an agency)."""
    domain = email.split("@")[-1].lower()
    agencies = db.scalars(select(Agency).where(Agency.is_active.is_(True))).all()
    for agency in agencies:
        if domain in [d.lower() for d in (agency.email_domains or [])]:
            return agency
    return None


def is_late(clock_in: datetime) -> bool:
    """True if clock-in is past shift start + grace (local wall-clock of the ts)."""
    cutoff = clock_in.replace(
        hour=settings.shift_start_hour,
        minute=settings.shift_start_minute + settings.shift_grace_minutes,
        second=0,
        microsecond=0,
    )
    return clock_in > cutoff


def get_or_create_employee_for_profile(db: Session, profile: Profile) -> Employee:
    """Resolve a dashboard Profile to its linked Employee row (same match
    order as the read-only /attendance/my lookup), self-registering one if
    this is the profile's first time clocking in — mirrors _login_employee's
    self-registration in routers/auth.py."""
    emp = None
    if profile.google_sub:
        emp = db.scalar(select(Employee).where(Employee.google_sub == profile.google_sub))
    if emp is None:
        emp = db.scalar(select(Employee).where(func.lower(Employee.email) == profile.email.lower()))
        if emp is not None and profile.google_sub:
            emp.google_sub = profile.google_sub
    if emp is None:
        agency = find_agency_by_email_domain(db, profile.email)
        emp = Employee(
            name=profile.full_name or profile.email.split("@")[0],
            email=profile.email,
            google_sub=profile.google_sub,
            agency_id=agency.id if agency else None,
            is_active=True,
        )
        db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


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
