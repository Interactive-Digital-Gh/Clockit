"""Export all Clockit data out of Supabase into JSON files.

Produces one JSON file per table in data_migration/data/, plus auth_users.json
(from the Supabase Auth admin API) so Google identities can be re-linked to
employees/profiles during import, and a manifest.json with row counts.

Requires the project's SERVICE ROLE key (RLS blocks the anon key from reading
these tables). Find it in the Supabase dashboard:
  Project Settings -> API -> Project API keys -> service_role

Usage:
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    python data_migration/export_from_supabase.py

    # SUPABASE_URL defaults to the Clockit project; override if it ever moves:
    export SUPABASE_URL=https://weqskfbsrwmlguygrgts.supabase.co
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://weqskfbsrwmlguygrgts.supabase.co").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

TABLES = ["agencies", "employees", "attendance_records", "profiles"]
PAGE_SIZE = 1000
DATA_DIR = Path(__file__).parent / "data"


def fetch_table(table: str) -> list[dict]:
    """Fetch every row of a table via PostgREST, paginating with Range headers."""
    rows: list[dict] = []
    start = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={"select": "*"},
            headers={
                "apikey": SERVICE_KEY,
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Range-Unit": "items",
                "Range": f"{start}-{start + PAGE_SIZE - 1}",
            },
            timeout=60,
        )
        if resp.status_code not in (200, 206):
            raise SystemExit(f"Failed to fetch {table}: HTTP {resp.status_code} — {resp.text[:300]}")
        page = resp.json()
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def fetch_auth_users() -> list[dict]:
    """Fetch Supabase Auth users (admin API) to recover Google subs and emails."""
    users: list[dict] = []
    page = 1
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": page, "per_page": PAGE_SIZE},
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
            timeout=60,
        )
        if resp.status_code != 200:
            raise SystemExit(
                f"Failed to fetch auth users: HTTP {resp.status_code} — {resp.text[:300]}"
            )
        batch = resp.json().get("users", [])
        # Keep only what the import needs — never persist password hashes etc.
        for u in batch:
            google_sub = None
            for ident in u.get("identities") or []:
                if ident.get("provider") == "google":
                    google_sub = (ident.get("identity_data") or {}).get("sub")
                    break
            users.append(
                {
                    "id": u.get("id"),
                    "email": u.get("email"),
                    "full_name": (u.get("user_metadata") or {}).get("full_name"),
                    "google_sub": google_sub,
                }
            )
        if len(batch) < PAGE_SIZE:
            return users
        page += 1


def main() -> None:
    if not SERVICE_KEY:
        raise SystemExit(
            "SUPABASE_SERVICE_ROLE_KEY is not set.\n"
            "Get it from the Supabase dashboard: Project Settings -> API -> service_role."
        )

    DATA_DIR.mkdir(exist_ok=True)
    manifest = {"exported_at": datetime.now(timezone.utc).isoformat(), "source": SUPABASE_URL, "counts": {}}

    for table in TABLES:
        rows = fetch_table(table)
        (DATA_DIR / f"{table}.json").write_text(json.dumps(rows, indent=1, default=str))
        manifest["counts"][table] = len(rows)
        print(f"  {table}: {len(rows)} rows")

    users = fetch_auth_users()
    (DATA_DIR / "auth_users.json").write_text(json.dumps(users, indent=1, default=str))
    manifest["counts"]["auth_users"] = len(users)
    print(f"  auth_users: {len(users)} rows")

    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"\nExport complete -> {DATA_DIR}")


if __name__ == "__main__":
    sys.exit(main())
