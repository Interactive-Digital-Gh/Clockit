"""Overview metrics + attendance aggregations for the dashboard.

Returns JSON; the dashboard renders PDF/Excel client-side (jsPDF / xlsx).
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import secrets as pysecrets

from ..config import get_settings
from ..database import get_db
from ..deps import require_roles
from ..models import VIEW_ALL_ROLES, Agency, AttendanceRecord, Employee, Profile
from ..schemas import AttendanceSummary, EmailReportRequest, EmailReportResult, OverviewMetrics
from ..services.attendance import today
from ..services.report_email import send_report

router = APIRouter(prefix="/reports", tags=["reports"])
settings = get_settings()


@router.get("/overview", response_model=OverviewMetrics)
def overview(db: Session = Depends(get_db), _=Depends(require_roles(*VIEW_ALL_ROLES))):
    t = today()
    employees = db.scalar(select(func.count()).select_from(Employee))
    agencies = db.scalar(select(func.count()).select_from(Agency))
    clocked_in = db.scalar(
        select(func.count())
        .select_from(AttendanceRecord)
        .where(AttendanceRecord.date == t, AttendanceRecord.clock_out_time.is_(None))
    )
    late = db.scalar(
        select(func.count())
        .select_from(AttendanceRecord)
        .where(AttendanceRecord.date == t, AttendanceRecord.status == "late")
    )
    return OverviewMetrics(
        employees=employees or 0,
        agencies=agencies or 0,
        clocked_in_today=clocked_in or 0,
        late_today=late or 0,
    )


@router.get("/attendance-summary", response_model=list[AttendanceSummary])
def attendance_summary(
    db: Session = Depends(get_db),
    _=Depends(require_roles(*VIEW_ALL_ROLES)),
    days: int = Query(30, ge=1, le=365),
):
    """Per-day present/late/total counts over the last `days` days."""
    start = today() - timedelta(days=days - 1)
    rows = db.execute(
        select(
            AttendanceRecord.date,
            func.count().label("total"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
            func.count().filter(AttendanceRecord.status == "present").label("present"),
        )
        .where(AttendanceRecord.date >= start)
        .group_by(AttendanceRecord.date)
        .order_by(AttendanceRecord.date)
    ).all()
    return [
        AttendanceSummary(date=r.date, present=r.present, late=r.late, total=r.total) for r in rows
    ]


@router.post("/email", response_model=EmailReportResult)
def email_report(
    body: EmailReportRequest,
    db: Session = Depends(get_db),
    prof: Profile = Depends(require_roles(*VIEW_ALL_ROLES)),
):
    """Build the attendance report for the range and email it (HTML summary +
    CSV attachment). Defaults to the requester's own address."""
    if body.date_from > body.date_to:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "date_from must be on or before date_to")
    to = body.to or prof.email
    if not send_report(db, to, body.date_from, body.date_to, message=body.message):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the report email")
    return EmailReportResult(sent=True, to=to)


@router.post("/email/weekly", response_model=list[EmailReportResult])
def email_weekly_report(
    db: Session = Depends(get_db),
    x_report_key: str | None = Header(default=None),
):
    """Scheduled trigger (systemd timer + curl): email last week's (Mon-Sun)
    report to every viewer-role profile. Guarded by a shared secret header
    instead of a session, since no user is involved."""
    if not settings.report_email_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "REPORT_EMAIL_KEY not configured")
    if not x_report_key or not pysecrets.compare_digest(x_report_key, settings.report_email_key):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid report key")

    t = today()
    last_monday = t - timedelta(days=t.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)

    recipients = db.scalars(select(Profile).where(Profile.role.in_(VIEW_ALL_ROLES))).all()
    return [
        EmailReportResult(sent=send_report(db, p.email, last_monday, last_sunday), to=p.email)
        for p in recipients
    ]
