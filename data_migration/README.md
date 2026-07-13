# Supabase → Clockit Postgres data migration

Two scripts, one data folder:

| File | What it does |
|---|---|
| `export_from_supabase.py` | Pulls every row of `agencies`, `employees`, `attendance_records`, `profiles` out of Supabase (plus auth users, to recover Google identities) into `data/*.json`. |
| `import_to_postgres.py` | Upserts those JSON files into whatever Postgres `Backend/.env` points at. Idempotent — safe to re-run. |
| `data/` | The exported JSON. **Contains employee personal data — never commit it.** |

The export runs **once**; the resulting `data/` folder is the portable artifact.
Import it into local Postgres today, then rsync/copy the same folder to the
server and import again there — no need to touch Supabase a second time.

## 1. Export (one time)

Needs the **service_role** key (the anon key is blocked by RLS):
Supabase dashboard → Project Settings → API → Project API keys → `service_role`.

```bash
cd Backend
source .venv/bin/activate
export SUPABASE_SERVICE_ROLE_KEY='eyJ...'
python data_migration/export_from_supabase.py
```

## 2. Import into local Postgres

```bash
cd Backend
source .venv/bin/activate
alembic upgrade head                          # make sure schema is current
python data_migration/import_to_postgres.py
```

## 3. Import into the server (when deployed)

Copy `data_migration/data/` to the server alongside the backend, then on the
server (with its own `.env` / `DATABASE_URL`):

```bash
cd Backend
alembic upgrade head
python data_migration/import_to_postgres.py
```

## Mapping notes

- Row UUIDs and timestamps are **preserved** — history stays intact.
- `employees.auth_user_id` → `employees.google_sub` (via each auth user's
  Google identity). Employees who never signed in stay pre-registered.
- `profiles.id` was the Supabase auth user id → `google_sub` is looked up by it.
- Old attendance rows get `location_verified=false` / `off_site` unless a
  legacy network flag says otherwise; audit IP columns stay NULL for them.
- Legacy columns with no new-schema equivalent are skipped and reported.
