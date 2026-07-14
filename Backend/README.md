# Clockit API (FastAPI)

The single source of truth for the Clockit **mobile app** (employee clock-in)
and **dashboard** (admin). Only this service talks to Postgres — the clients
talk only to this API. Replaces the previous direct-to-Supabase setup (Supabase
Auth + auto REST + RLS are all reimplemented here)...

## Stack
- **FastAPI** + Uvicorn/Gunicorn
- **PostgreSQL 16** (self-hosted)
- **SQLAlchemy 2.0** ORM + **Alembic** migrations
- **Google ID-token** verification → app-issued **JWT** (access + refresh)
- Role-based authz (`super_admin`, `it`, `hr`, `front_desk`)

## Layout
```
app/
  main.py            FastAPI app + CORS + router wiring
  config.py          env-driven settings (pydantic-settings)
  database.py        engine / session / Base
  models.py          SQLAlchemy models (schema source of truth)
  schemas.py         Pydantic request/response models
  security.py        JWT + Google token verification
  deps.py            auth dependencies (principal, require_roles)
  services/          business logic (attendance rules, network check)
  routers/           auth, employees, agencies, attendance, profiles, reports
  tasks/             cron scripts (close_open_shifts = server auto clock-out)
alembic/             migrations (0001_initial matches models.py)
```

## Run locally (Docker — easiest)
```bash
cp .env.example .env          # then edit JWT_SECRET + Google client IDs
docker compose up --build     # Postgres + API, migrations run on start
# API at http://localhost:8000, docs at http://localhost:8000/docs
```

## Run locally (without Docker)
```bash
python3.12 -m venv .venv && source .venv/bin/activate   # 3.12 required (3.14 breaks pydantic-core)
pip install -r requirements.txt
cp .env.example .env          # point DATABASE_URL at your Postgres, set secrets

# One-time local Postgres setup (dedicated role + db):
#   createuser? use: psql postgres -c "CREATE ROLE clockit LOGIN PASSWORD 'clockit';"
#   createdb -O clockit clockit
alembic upgrade head          # create the schema
python seed.py                # optional: sample agencies/employees/attendance
uvicorn app.main:app --reload # if :8000 is taken, add --port 8010
```

### Testing locally without Google (DEV_MODE)
Every endpoint needs a bearer token, and tokens normally come from a real Google
sign-in. For local testing set `DEV_MODE=true` in `.env` to enable a bypass that
mints tokens directly (returns 404 when DEV_MODE is off, so it's invisible in prod):
```bash
# admin (dashboard) token
curl -sX POST localhost:8010/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@interactivedigital.com","as_type":"admin"}'
# employee (mobile) token
curl -sX POST localhost:8010/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"zanele@interactivedigital.com","as_type":"employee"}'
```
Use the returned `access_token` as `Authorization: Bearer <token>`, or just open
the interactive docs at `/docs` and paste it into "Authorize".

## Auth flow
Both clients sign in with Google on-device, then send the Google **ID token** here:

| Client    | Endpoint                     | Result                                            |
|-----------|------------------------------|---------------------------------------------------|
| Mobile    | `POST /auth/google/employee` | Links/claims/creates an `employee`, returns tokens |
| Dashboard | `POST /auth/google/admin`    | Links/creates a `profile` (role), returns tokens   |

Response: `{ access_token, refresh_token }`. Send `Authorization: Bearer <access_token>`
on every call. Refresh via `POST /auth/refresh`. The **first** admin to sign in
becomes `super_admin`; everyone else starts as `front_desk` and must be promoted
on the Users page (`PATCH /profiles/{id}/role`, requires super_admin/it).

## Key endpoints
- `GET  /health`
- Employee (mobile): `GET /attendance/me/today`, `GET /attendance/me/history`,
  `POST /attendance/clock-in` (body `{ local_ip }`, validated vs. agency subnets),
  `POST /attendance/clock-out`
- Admin (dashboard): `GET /attendance`, `GET /employees`, `POST/PATCH /employees`,
  `GET /agencies`, `POST/PATCH /agencies`, `GET /profiles`, `PATCH /profiles/{id}/role`,
  `GET /reports/overview`, `GET /reports/attendance-summary`
- Full interactive docs at `/docs`.

## Business rules (moved server-side from the mobile client)
- **Late detection** — clock-in past `SHIFT_START` + grace → `status = late`.
- **Idempotent clock-in** — one row per employee per day (DB unique constraint).
- **total_hours** — computed on clock-out.
- **Network gate** — clock-in rejected if the device IP isn't on the agency's
  `network_config.allowed_subnets`. See `services/network.py` for the spoofability
  caveat and how to harden (public-IP allowlist / on-site terminal).
- **Auto clock-out** — `python -m app.tasks.close_open_shifts` via cron closes
  shifts left open at end of day.

## Migrating data off Supabase
1. Export the four tables from Supabase (`pg_dump --data-only -t agencies -t
   employees -t attendance_records -t profiles`, or CSV per table).
2. `alembic upgrade head` on the new DB, then load the data.
3. On first Google sign-in, existing rows get linked by email (`google_sub` is
   backfilled automatically) — no need to pre-populate `google_sub`.

## Location verification (on-site vs remote clock-in)
Clock-in is **never blocked** — an employee can clock in anywhere. Each record is
stamped with where it happened so admins get certainty on-site clock-ins are real:
- `verification_source`: `office_ip` (request came from the agency's public/WAN IP
  — trusted, unspoofable) › `office_subnet` (device reported a matching LAN prefix
  — weak hint) › `off_site` (neither). `location_verified` is true for the first two.
- Configure per agency in `network_config`: `allowed_public_ips` (the office WAN
  IP(s), e.g. `["203.0.113.7"]`; prefix match supported) and optionally
  `allowed_subnets`. Editable from the dashboard Agencies page.

**Reverse-proxy requirement:** the `office_ip` signal reads the real client IP
from `X-Forwarded-For`. Your proxy MUST set it (nginx:
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`) and the app must be
reachable **only** through the proxy (bind uvicorn to localhost), otherwise a client
could spoof the header by talking to the app directly.

## Production notes
- Put this behind nginx/Caddy with TLS; run via the Docker image or
  `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 127.0.0.1:8000`.
- Set a strong `JWT_SECRET`, lock `CORS_ORIGINS` to the dashboard domain, and
  **set `DEV_MODE=false`** (dev-login is an auth bypass).
- **You now own DB backups** (`pg_dump` cron) and patching — Supabase did this before.
