# Clockit

Employee attendance for Interactive Digital: QR clock-in with on-site/remote
verification, and an admin dashboard for tracking and reports.

| Directory | What it is | Runs at |
| --- | --- | --- |
| `Backend/` | FastAPI + Postgres API — the single source of truth | https://clockit-api.interactivedigital.com.gh |
| `Dashboard/` | Next.js admin dashboard | https://clockit.interactivedigital.com.gh |
| `Mobile_App/` | Expo / React Native employee app (iOS & Android) | EAS builds |

Deploys run from `.github/workflows/` on pushes to `main`, filtered by the
paths each workflow watches — a backend-only change won't redeploy the
dashboard, and vice versa. The mobile app ships through EAS, not the server.
