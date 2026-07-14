"""Overview metrics + attendance aggregations for the dashboard.

Returns JSON; the dashboard renders PDF/Excel client-side (jsPDF / xlsx).
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import VIEW_ALL_ROLES, Agency, AttendanceRecord, Employee
from ..schemas import AttendanceSummary, OverviewMetrics
from ..services.attendance import today

router = APIRouter(prefix="/reports", tags=["reports"])


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
