"""Recurring planned work location; actual attendance remains independent."""
from datetime import date


def scheduled_mode(schedule: dict | None, day: date) -> str | None:
    if not schedule:
        return None
    start = date.fromisoformat(schedule['starts_on'])
    if day < start:
        return None
    weeks = schedule['weeks']
    week = ((day - start).days // 7) % len(weeks)
    return weeks[week][day.weekday()]
