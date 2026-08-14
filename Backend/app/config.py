from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database -----------------------------------------------------------
    database_url: str = "postgresql+psycopg2://clockit:clockit@localhost:5432/clockit"

    # --- Auth / JWT ---------------------------------------------------------
    jwt_secret: str = "CHANGE-ME-generate-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12h
    refresh_token_expire_days: int = 30

    # Google OAuth client IDs that we accept ID tokens from (mobile + web).
    google_web_client_id: str | None = None
    google_ios_client_id: str | None = None
    # Optional extra client IDs, comma-separated.
    google_extra_client_ids: str = ""

    # If set (e.g. "interactivedigital.com"), only Google accounts on this
    # domain may sign in. Empty = allow any Google account.
    allowed_email_domain: str = ""

    # --- Shift rules (mirrors Mobile_App/src/config/attendance.ts) ----------
    shift_start_hour: int = 8
    shift_start_minute: int = 30
    shift_grace_minutes: int = 5

    # --- CORS ---------------------------------------------------------------
    # Comma-separated list of allowed origins for the dashboard. "*" for any.
    cors_origins: str = "*"

    # --- Public URLs ----------------------------------------------------------
    # The dashboard's own public origin — used to build the QR code's target
    # link. Override locally (e.g. APP_URL=http://localhost:3000) to test the
    # scan-to-clock-in flow against a local dashboard dev server.
    app_url: str = "https://clockit.interactivedigital.com.gh"

    @property
    def allowed_google_client_ids(self) -> list[str]:
        ids = [self.google_web_client_id, self.google_ios_client_id]
        ids += [c.strip() for c in self.google_extra_client_ids.split(",")]
        return [i for i in ids if i]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()] or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
