from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import agencies, attendance, auth, employees, profiles, reports

settings = get_settings()

app = FastAPI(
    title="Clockit API",
    version="1.0.0",
    description="Single source of truth for the Clockit attendance mobile app and dashboard.",
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


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
