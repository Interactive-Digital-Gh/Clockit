"""Seed the local database with sample data for testing.

Idempotent: safe to run repeatedly (matches on natural keys). Run with the
project's .env loaded:

    python seed.py
"""

from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Agency, AttendanceRecord, Employee, Profile


def upsert_agency(db, name, **kw) -> Agency:
    obj = db.scalar(select(Agency).where(Agency.name == name))
    if obj is None:
        obj = Agency(name=name, **kw)
        db.add(obj)
        db.flush()
    return obj


def upsert_employee(db, email, **kw) -> Employee:
    obj = db.scalar(select(Employee).where(Employee.email == email))
    if obj is None:
        obj = Employee(email=email, **kw)
        db.add(obj)
        db.flush()
    return obj


def upsert_profile(db, email, **kw) -> Profile:
    obj = db.scalar(select(Profile).where(Profile.email == email))
    if obj is None:
        obj = Profile(email=email, **kw)
        db.add(obj)
        db.flush()
    return obj


def main() -> None:
    db = SessionLocal()
    try:
        # --- Agencies (one locked to a subnet, one open) --------------------
        hq = upsert_agency(
            db,
            "Interactive Digital HQ",
            agency_code="ID-HQ",
            address="123 Main St",
            network_config={
                # Office public/WAN IP (example — replace with the real one).
                "allowed_public_ips": ["203.0.113."],
                "allowed_subnets": ["192.168."],
                "description": "Office WiFi",
            },
            email_domains=["interactivedigital.com"],
        )
        remote = upsert_agency(
            db,
            "Remote / Field",
            agency_code="ID-REM",
            address=None,
            network_config={"allowed_subnets": []},  # no restriction
            email_domains=[],
        )

        # --- Admin profile (dashboard) --------------------------------------
        upsert_profile(
            db,
            "admin@interactivedigital.com",
            full_name="Dashboard Admin",
            role="super_admin",
        )

        # --- Employees (mobile). Pre-registered by HR (no google_sub yet). --
        employees = [
            upsert_employee(db, "amara@interactivedigital.com", name="Amara Okoye",
                            emp_id="E001", job_title="Designer", employment_type="Full-time",
                            agency_id=hq.id),
            upsert_employee(db, "kwame@interactivedigital.com", name="Kwame Mensah",
                            emp_id="E002", job_title="Developer", employment_type="Full-time",
                            agency_id=hq.id),
            upsert_employee(db, "zanele@interactivedigital.com", name="Zanele Dube",
                            emp_id="E003", job_title="PM", employment_type="Contract",
                            agency_id=remote.id),
        ]
        db.flush()

        # --- Attendance for the last 5 weekdays -----------------------------
        created = 0
        today = datetime.now(timezone.utc).date()
        for emp in employees:
            for back in range(5):
                d = today - timedelta(days=back)
                if d.weekday() >= 5:  # skip weekends
                    continue
                exists = db.scalar(
                    select(AttendanceRecord).where(
                        AttendanceRecord.employee_id == emp.id, AttendanceRecord.date == d
                    )
                )
                if exists:
                    continue
                # Vary clock-in: E002 is late, others on time.
                in_minute = 45 if emp.emp_id == "E002" else 15
                cin = datetime.combine(d, time(8, in_minute), tzinfo=timezone.utc)
                cout = datetime.combine(d, time(17, 0), tzinfo=timezone.utc)
                is_today = d == today
                db.add(
                    AttendanceRecord(
                        employee_id=emp.id,
                        date=d,
                        clock_in_time=cin,
                        clock_out_time=None if is_today else cout,
                        status="late" if in_minute > 35 else "present",
                        total_hours=None if is_today else round((cout - cin).total_seconds() / 3600, 2),
                        verification_method="manual",
                    )
                )
                created += 1

        db.commit()
        print(
            f"Seeded: {db.query(Agency).count()} agencies, "
            f"{db.query(Employee).count()} employees, "
            f"{db.query(Profile).count()} profiles, "
            f"+{created} attendance rows."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
