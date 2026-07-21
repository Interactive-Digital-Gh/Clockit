import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .models import AdminNotification
from .routers import agencies, attendance, auth, employees, notifications, profiles, reports
from .services.push import dispatch_notification

settings = get_settings()
logger = logging.getLogger("clockit.notifications")

NOTIFICATION_POLL_INTERVAL_S = 30


async def _poll_scheduled_notifications():
    """Sends any admin broadcast whose scheduled_for time has arrived. Runs
    in-process — fine for a single-instance deploy; would need a real job
    queue if this app ever scales to multiple API workers."""
    while True:
        await asyncio.sleep(NOTIFICATION_POLL_INTERVAL_S)
        try:
            with SessionLocal() as db:
                due = db.scalars(
                    select(AdminNotification).where(
                        AdminNotification.status == "scheduled",
                        AdminNotification.scheduled_for <= datetime.now(timezone.utc),
                    )
                ).all()
                for notification in due:
                    dispatch_notification(db, notification)
        except Exception:
            logger.exception("Scheduled notification poll failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_poll_scheduled_notifications())
    yield
    task.cancel()


app = FastAPI(
    title="Clockit API",
    version="1.0.0",
    description="Single source of truth for the Clockit attendance mobile app and dashboard.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(agencies.router)
app.include_router(attendance.router)
app.include_router(profiles.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
