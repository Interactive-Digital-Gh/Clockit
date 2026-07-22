"""Close any attendance rows still open at end of day.

Server-side replacement for the mobile app's per-device auto clock-out
(Mobile_App/src/tasks/autoClockOut.ts). The original clocked employees out at
17:30 once they'd been off the office network for 20 minutes; the server can't
observe a device's LAN network, so this instead closes any shift left open past
the shift end for the given day, stamping clock_out_time at the configured
end-of-day and computing total_hours.

Run from cron, e.g. every evening at 23:55:
    55 23 * * *  cd /opt/clockit/Backend && /opt/clockit/Backend/.venv/bin/python -m app.tasks.close_open_shifts

Defaults to today; pass a YYYY-MM-DD argument to backfill a specific date.
"""

import sys
from datetime import date, datetime, time, timezone

from sqlalchemy import select

from ..database import SessionLocal
from ..models import AttendanceRecord, AttendanceSession

# Wall-clock time we stamp auto clock-outs at (17:30, matching the old app).
CLOSE_HOUR = 17
CLOSE_MINUTE = 30


def close_open_shifts(target: date) -> int:
    """Closes each open row's open SESSION (not just the day's summary row) —
    a day can have multiple sessions if the employee left and came back, and
    total_hours must sum only actual on-site time, not the gaps between."""
    db = SessionLocal()
    closed = 0
    try:
        open_rows = db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.date == target,
                AttendanceRecord.clock_out_time.is_(None),
            )
        ).all()

        for row in open_rows:
            close_at = datetime.combine(
                target, time(CLOSE_HOUR, CLOSE_MINUTE), tzinfo=timezone.utc
            )
            sessions = db.scalars(
                select(AttendanceSession)
                .where(AttendanceSession.attendance_record_id == row.id)
                .order_by(AttendanceSession.clock_in_time)
            ).all()
            open_session = next((s for s in sessions if s.clock_out_time is None), None)
            if open_session is None:
                continue  # record shows open but has no session — nothing to close

            # Never stamp a clock-out before the session's clock-in.
            if close_at < open_session.clock_in_time:
                close_at = open_session.clock_in_time
            open_session.clock_out_time = close_at

            row.clock_out_time = close_at
            row.total_hours = round(
                sum(
                    (s.clock_out_time - s.clock_in_time).total_seconds()
                    for s in sessions
                    if s.clock_out_time is not None
                )
                / 3600,
                2,
            )
            closed += 1

        db.commit()
        return closed
    finally:
        db.close()


if __name__ == "__main__":
    target = (
        date.fromisoformat(sys.argv[1])
        if len(sys.argv) > 1
        else datetime.now(timezone.utc).date()
    )
    count = close_open_shifts(target)
    print(f"Closed {count} open shift(s) for {target}.")
