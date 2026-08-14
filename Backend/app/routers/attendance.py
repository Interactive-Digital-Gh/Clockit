"""Attendance endpoints.

Employee (mobile): clock in/out, own today's record, own history.
Admin (dashboard): browse/filter all records and the live feed.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

import secrets

from sqlalchemy import func

from ..database import get_db
from ..deps import get_current_admin, get_current_employee, get_principal, require_roles
from ..models import (
    ADMIN_ROLES,
    VIEW_ALL_ROLES,
    AttendanceQr,
    AttendanceQrSettings,
    AttendanceRecord,
    Employee,
    Profile,
)
from ..schemas import (
    AttendanceOut,
    AttendanceQrOut,
    AttendanceQrSettingsOut,
    AttendanceQrSettingsUpdate,
    AttendanceWithEmployee,
    ClockInRequest,
)
from ..services import attendance as svc
from ..services.network import classify_location, get_client_ip

router = APIRouter(prefix="/attendance", tags=["attendance"])


# --- Employee (mobile) ------------------------------------------------------
@router.get("/me/today", response_model=AttendanceOut | None)
def my_today(db: Session = Depends(get_db), emp: Employee = Depends(get_current_employee)):
    return svc.get_today_record(db, emp.id)


@router.get("/me/history", response_model=list[AttendanceOut])
def my_history(
    db: Session = Depends(get_db),
    emp: Employee = Depends(get_current_employee),
    limit: int = Query(30, ge=1, le=365),
):
    stmt = (
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.sessions))
        .where(AttendanceRecord.employee_id == emp.id)
        .order_by(AttendanceRecord.date.desc())
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.post("/clock-in", response_model=AttendanceOut)
def clock_in(
    body: ClockInRequest,
    request: Request,
    db: Session = Depends(get_db),
    emp: Employee = Depends(get_current_employee),
):
    # Never blocks — classify where the clock-in happened for the admins.
    public_ip = get_client_ip(request)
    agency = emp.agency
    network_config = agency.network_config if agency else None
    verified, source = classify_location(
        public_ip,
        body.local_ip,
        network_config,
        agency_latitude=float(agency.latitude) if agency and agency.latitude is not None else None,
        agency_longitude=float(agency.longitude) if agency and agency.longitude is not None else None,
        agency_radius_m=agency.geofence_radius_m if agency else None,
        device_latitude=body.latitude,
        device_longitude=body.longitude,
    )
    return svc.clock_in(
        db,
        emp.id,
        location_verified=verified,
        verification_source=source,
        public_ip=public_ip,
        local_ip=body.local_ip,
        latitude=body.latitude,
        longitude=body.longitude,
    )


@router.post("/clock-out", response_model=AttendanceOut)
def clock_out(db: Session = Depends(get_db), emp: Employee = Depends(get_current_employee)):
    try:
        return svc.clock_out(db, emp.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


# --- Attendance QR token ----------------------------------------------------
def _current_qr(db: Session) -> AttendanceQr:
    qr = db.scalar(select(AttendanceQr).order_by(AttendanceQr.created_at.desc()).limit(1))
    if qr is None:  # pre-seed safety net; migration 0004 seeds the first row
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No attendance QR token configured")
    return qr


def _get_qr_settings(db: Session) -> AttendanceQrSettings:
    settings = db.scalar(select(AttendanceQrSettings).limit(1))
    if settings is None:  # pre-seed safety net; migration 0009 seeds the singleton row
        settings = AttendanceQrSettings(rotation_minutes=None)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _current_qr_autorotate(db: Session) -> AttendanceQr:
    """The active QR token, auto-rotating it first if the admin-configured
    interval has elapsed since it was minted. rotation_minutes=None (the
    default) means manual-only — identical to _current_qr()."""
    qr = _current_qr(db)
    settings = _get_qr_settings(db)
    if settings.rotation_minutes is not None:
        elapsed = datetime.now(timezone.utc) - qr.created_at
        if elapsed >= timedelta(minutes=settings.rotation_minutes):
            qr = AttendanceQr(
                token=f"clockit:attendance:interactive-digital:{secrets.token_urlsafe(9)}",
                rotated_by="auto",
            )
            db.add(qr)
            db.commit()
            db.refresh(qr)
    return qr


@router.get("/qr", response_model=AttendanceQrOut)
def get_qr(db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))):
    """The active QR token, for the dashboard's QR management page."""
    return _current_qr_autorotate(db)


@router.post("/qr/rotate", response_model=AttendanceQrOut)
def rotate_qr(db: Session = Depends(get_db), admin: Profile = Depends(require_roles(*ADMIN_ROLES))):
    """Mint a new QR token, immediately invalidating the previous one.
    Old tokens are kept as rows for the audit trail. This also resets the
    auto-rotation timer, since it's based on the newest row's created_at."""
    qr = AttendanceQr(
        token=f"clockit:attendance:interactive-digital:{secrets.token_urlsafe(9)}",
        rotated_by=admin.email,
    )
    db.add(qr)
    db.commit()
    db.refresh(qr)
    return qr


@router.get("/qr/current", response_model=AttendanceQrOut)
def get_qr_current(db: Session = Depends(get_db), _=Depends(get_principal)):
    """The active QR token, for the mobile/web scanner to validate scans
    against. Any signed-in Employee or Profile — this isn't a security
    control, just the value the client compares a scan to before clocking in."""
    return _current_qr_autorotate(db)


@router.get("/qr/display", response_model=AttendanceQrOut)
def get_qr_display(db: Session = Depends(get_db)):
    """The active QR token, with no auth requirement at all. Meant for a
    front-desk kiosk screen that never logs in — it returns exactly what's
    already physically visible on that screen, so there's nothing extra
    exposed by making the read itself public (mirrors /qr/current, which
    already only requires *some* signed-in principal rather than an admin)."""
    return _current_qr_autorotate(db)


@router.get("/qr/settings", response_model=AttendanceQrSettingsOut)
def get_qr_settings(db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))):
    return _get_qr_settings(db)


@router.patch("/qr/settings", response_model=AttendanceQrSettingsOut)
def update_qr_settings(
    body: AttendanceQrSettingsUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_roles(*ADMIN_ROLES)),
):
    settings = _get_qr_settings(db)
    settings.rotation_minutes = body.rotation_minutes
    settings.updated_by = admin.email
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    return settings


# --- Personal (dashboard, any role) ----------------------------------------
@router.get("/my", response_model=list[AttendanceOut])
def my_attendance_as_profile(
    db: Session = Depends(get_db),
    prof: Profile = Depends(get_current_admin),
    limit: int = Query(60, ge=1, le=365),
):
    """The signed-in dashboard user's own attendance, resolved to their
    employee record by Google identity or email. Empty if they have none."""
    emp = None
    if prof.google_sub:
        emp = db.scalar(select(Employee).where(Employee.google_sub == prof.google_sub))
    if emp is None:
        emp = db.scalar(select(Employee).where(func.lower(Employee.email) == prof.email.lower()))
    if emp is None:
        return []
    stmt = (
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.sessions))
        .where(AttendanceRecord.employee_id == emp.id)
        .order_by(AttendanceRecord.date.desc())
        .limit(limit)
    )
    return db.scalars(stmt).all()


@router.get("/my/today", response_model=AttendanceOut | None)
def my_today_as_profile(db: Session = Depends(get_db), prof: Profile = Depends(get_current_admin)):
    emp = svc.get_or_create_employee_for_profile(db, prof)
    return svc.get_today_record(db, emp.id)


@router.post("/my/clock-in", response_model=AttendanceOut)
def my_clock_in_as_profile(
    body: ClockInRequest,
    request: Request,
    db: Session = Depends(get_db),
    prof: Profile = Depends(get_current_admin),
):
    """Dashboard-side clock-in for any signed-in Profile — same rules and
    verification as the mobile endpoint, just resolved from a Profile
    instead of an Employee token."""
    emp = svc.get_or_create_employee_for_profile(db, prof)
    public_ip = get_client_ip(request)
    agency = emp.agency
    network_config = agency.network_config if agency else None
    verified, source = classify_location(
        public_ip,
        body.local_ip,
        network_config,
        agency_latitude=float(agency.latitude) if agency and agency.latitude is not None else None,
        agency_longitude=float(agency.longitude) if agency and agency.longitude is not None else None,
        agency_radius_m=agency.geofence_radius_m if agency else None,
        device_latitude=body.latitude,
        device_longitude=body.longitude,
    )
    return svc.clock_in(
        db,
        emp.id,
        location_verified=verified,
        verification_source=source,
        public_ip=public_ip,
        local_ip=body.local_ip,
        latitude=body.latitude,
        longitude=body.longitude,
    )


@router.post("/my/clock-out", response_model=AttendanceOut)
def my_clock_out_as_profile(db: Session = Depends(get_db), prof: Profile = Depends(get_current_admin)):
    emp = svc.get_or_create_employee_for_profile(db, prof)
    try:
        return svc.clock_out(db, emp.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


# --- Admin (dashboard) ------------------------------------------------------
@router.get("", response_model=list[AttendanceWithEmployee])
def list_attendance(
    db: Session = Depends(get_db),
    _=Depends(require_roles(*VIEW_ALL_ROLES)),
    date_from: date | None = None,
    date_to: date | None = None,
    on_date: date | None = None,
    employee_id: uuid.UUID | None = None,
    agency_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(1000, ge=1, le=10000),
):
    stmt = (
        select(AttendanceRecord)
        .options(
            joinedload(AttendanceRecord.employee).joinedload(Employee.agency),
            selectinload(AttendanceRecord.sessions),
        )
        .order_by(AttendanceRecord.clock_in_time.desc())
    )
    if on_date is not None:
        stmt = stmt.where(AttendanceRecord.date == on_date)
    if date_from is not None:
        stmt = stmt.where(AttendanceRecord.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(AttendanceRecord.date <= date_to)
    if employee_id is not None:
        stmt = stmt.where(AttendanceRecord.employee_id == employee_id)
    if status_filter is not None:
        stmt = stmt.where(AttendanceRecord.status == status_filter)
    if agency_id is not None:
        stmt = stmt.join(Employee).where(Employee.agency_id == agency_id)
    return db.scalars(stmt.limit(limit)).all()
