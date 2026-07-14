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
from ..models import AttendanceRecord
from ..services.attendance import compute_total_hours

# Wall-clock time we stamp auto clock-outs at (17:30, matching the old app).
CLOSE_HOUR = 17
CLOSE_MINUTE = 30


def close_open_shifts(target: date) -> int:
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
            # Never stamp a clock-out before the clock-in.
            if close_at < row.clock_in_time:
                close_at = row.clock_in_time
            row.clock_out_time = close_at
            row.total_hours = compute_total_hours(row.clock_in_time, close_at)
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
