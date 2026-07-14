"""Import the Supabase export (data_migration/data/*.json) into Clockit Postgres.

Idempotent: rows are upserted by primary key, so it is safe to re-run — both
against the local database and later against the production server. Original
UUIDs and timestamps are preserved, so nothing else (tokens, FKs, history)
breaks.

Targets whatever DATABASE_URL the backend is configured with (Backend/.env),
so the same command migrates the server once the backend is deployed there:

    cd Backend
    alembic upgrade head                     # schema first
    python data_migration/import_to_postgres.py

Schema mapping notes:
  - employees.auth_user_id (Supabase auth FK)  -> employees.google_sub, via the
    Google identity in auth_users.json. Unclaimed rows stay unclaimed.
  - profiles.id == auth.users.id on Supabase   -> google_sub looked up by id.
  - attendance location columns didn't exist on Supabase; historical rows get
    location_verified from any legacy network flag if present, else false
    ('off_site'). Auditing IPs stay NULL for historical rows.
  - Unknown/extra exported columns are ignored (reported at the end).
"""

import json
import sys
from pathlib import Path

# Allow running from Backend/ or from data_migration/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import SessionLocal
from app.models import Agency, AttendanceRecord, Employee, Profile

DATA_DIR = Path(__file__).parent / "data"

LEGACY_NETWORK_FLAGS = ("location_verified", "is_within_network", "within_network", "network_verified")


def load(name: str) -> list[dict]:
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        raise SystemExit(f"Missing {path} — run export_from_supabase.py first.")
    return json.loads(path.read_text())


def upsert_all(db, model, rows: list[dict], ignored: dict[str, set[str]]) -> int:
    """Upsert rows by primary key, keeping only columns the model knows."""
    table = model.__table__
    known = set(table.columns.keys())
    count = 0
    for row in rows:
        values = {k: v for k, v in row.items() if k in known}
        ignored.setdefault(table.name, set()).update(k for k in row if k not in known)
        stmt = pg_insert(table).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={k: stmt.excluded[k] for k in values if k != "id"},
        )
        db.execute(stmt)
        count += 1
    return count


def main() -> None:
    agencies = load("agencies")
    employees = load("employees")
    attendance = load("attendance_records")
    profiles = load("profiles")
    auth_users = load("auth_users")

    # auth.users.id -> google sub (only users who signed in with Google have one)
    sub_by_auth_id = {u["id"]: u["google_sub"] for u in auth_users if u.get("google_sub")}

    # Re-link identities.
    for emp in employees:
        emp["google_sub"] = sub_by_auth_id.get(emp.get("auth_user_id"))
    for prof in profiles:
        prof["google_sub"] = sub_by_auth_id.get(prof.get("id"))

    # Derive the new location columns for historical attendance rows.
    warned_clockout = 0
    for rec in attendance:
        verified = any(rec.get(flag) is True for flag in LEGACY_NETWORK_FLAGS)
        rec["location_verified"] = verified
        rec.setdefault("verification_source", "office_subnet" if verified else "off_site")
        # Guard the clock_out >= clock_in check constraint against bad legacy rows.
        cin, cout = rec.get("clock_in_time"), rec.get("clock_out_time")
        if cin and cout and str(cout) < str(cin):
            rec["clock_out_time"] = None
            warned_clockout += 1

    ignored: dict[str, set[str]] = {}
    db = SessionLocal()
    try:
        # FK order: agencies -> employees -> attendance; profiles independent.
        n_ag = upsert_all(db, Agency, agencies, ignored)
        n_emp = upsert_all(db, Employee, employees, ignored)
        n_att = upsert_all(db, AttendanceRecord, attendance, ignored)
        n_prof = upsert_all(db, Profile, profiles, ignored)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Imported (upserted): {n_ag} agencies, {n_emp} employees, "
          f"{n_att} attendance records, {n_prof} profiles.")
    linked = sum(1 for e in employees if e.get("google_sub"))
    print(f"Google identities re-linked: {linked} employees, "
          f"{sum(1 for p in profiles if p.get('google_sub'))} profiles.")
    if warned_clockout:
        print(f"WARNING: nulled clock_out_time on {warned_clockout} rows where it "
              f"preceded clock_in_time (violated the new check constraint).")
    for table_name, cols in sorted(ignored.items()):
        if cols:
            print(f"Ignored legacy {table_name} columns with no equivalent in the "
                  f"new schema: {', '.join(sorted(cols))}")


if __name__ == "__main__":
    main()
