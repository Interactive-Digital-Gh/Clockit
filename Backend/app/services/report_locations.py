"""Date-specific planned vs recorded work locations, including missing clock-ins."""
from datetime import timedelta
from .work_schedule import scheduled_mode
from .attendance import today

PLAN_LABELS = {'office': 'Office', 'remote': 'Remote', 'off': 'Off duty', None: 'Not set'}
NOTE = 'Planned locations use the current employee schedule; schedule history is not stored. Remote / unverified means no office verification, not proof of remote work.'


def recorded_location(record):
    if record is None:
        return 'No clock-in'
    sessions = getattr(record, 'sessions', None) or [record]
    verified = [s.location_verified for s in sessions]
    if all(verified):
        return 'On-site'
    if any(verified):
        return 'Mixed on-site / unverified'
    return 'Remote / unverified'


def location_check(plan, actual, day):
    if actual == 'No clock-in':
        if day > today():
            return 'Not yet due'
        return 'No clock-in' if plan in ('office', 'remote') else 'Not scheduled' if plan == 'off' else 'Schedule not set'
    if plan == 'office' and actual == 'Remote / unverified':
        return 'Office expected; unverified'
    if plan == 'remote' and actual != 'Remote / unverified':
        return 'Remote planned; on-site recorded'
    return 'Off-duty clock-in' if plan == 'off' else 'Schedule not set' if plan is None else 'Recorded'


def build_location_rows(employees, records, start, end):
    roster = {str(e.id): e for e in employees}
    indexed = {}
    for r in records:
        indexed[(str(r.employee_id), r.date)] = r
        if str(r.employee_id) not in roster and r.employee:
            roster[str(r.employee_id)] = r.employee
    rows = []
    day = start
    while day <= end:
        for key, employee in sorted(roster.items(), key=lambda item: item[1].name.lower()):
            record = indexed.get((key, day))
            plan = scheduled_mode(employee.work_schedule, day)
            actual = recorded_location(record)
            rows.append(dict(date=day.isoformat(), employee_id=key, name=employee.name, email=employee.email or '', agency=employee.agency.name if employee.agency else '', planned=PLAN_LABELS[plan], actual=actual, check=location_check(plan, actual, day)))
        day += timedelta(days=1)
    return rows
