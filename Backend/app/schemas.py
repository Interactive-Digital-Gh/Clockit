"""Pydantic v2 request/response schemas."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Role = Literal["super_admin", "it", "hr", "front_desk", "employee"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth -------------------------------------------------------------------
class GoogleLogin(BaseModel):
    id_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class DevLogin(BaseModel):
    """Local-dev token request (only honored when DEV_MODE=true)."""

    email: EmailStr
    name: str | None = None
    as_type: Literal["employee", "admin"] = "admin"


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Me(BaseModel):
    type: Literal["employee", "admin"]
    id: uuid.UUID
    email: str | None = None
    name: str | None = None
    role: Role | None = None
    agency_id: uuid.UUID | None = None


# --- Agencies ---------------------------------------------------------------
class NetworkConfig(BaseModel):
    # Office public/WAN IP(s) — the trusted on-site signal (server-observed).
    allowed_public_ips: list[str] = Field(default_factory=list)
    # Device-reported LAN prefixes — secondary hint (e.g. "192.168.10.").
    allowed_subnets: list[str] = Field(default_factory=list)
    description: str | None = None


class AgencyBase(BaseModel):
    name: str
    agency_code: str | None = None
    address: str | None = None
    is_active: bool = True
    network_config: NetworkConfig | None = None
    email_domains: list[str] | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_m: int | None = None


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: str | None = None
    agency_code: str | None = None
    address: str | None = None
    is_active: bool | None = None
    network_config: NetworkConfig | None = None
    email_domains: list[str] | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_m: int | None = None


class AgencyOut(ORMModel, AgencyBase):
    id: uuid.UUID


class AgencyRef(ORMModel):
    id: uuid.UUID
    name: str


# --- Employees --------------------------------------------------------------
class EmployeeBase(BaseModel):
    name: str
    email: EmailStr | None = None
    emp_id: str | None = None
    job_title: str | None = None
    employment_type: str | None = None
    date_join: date | None = None
    agency_id: uuid.UUID | None = None
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    emp_id: str | None = None
    job_title: str | None = None
    employment_type: str | None = None
    date_join: date | None = None
    agency_id: uuid.UUID | None = None
    is_active: bool | None = None


class EmployeeSelfUpdate(BaseModel):
    """What an employee may change about themselves (mobile onboarding)."""

    name: str | None = None
    job_title: str | None = None


class EmployeeOut(ORMModel, EmployeeBase):
    id: uuid.UUID
    agency: AgencyRef | None = None


# --- Attendance -------------------------------------------------------------
class ClockInRequest(BaseModel):
    # Device-reported LAN IP, validated against the agency's allowed subnets.
    local_ip: str | None = None
    # Device-reported GPS coordinates, checked against the agency's geofence.
    latitude: float | None = None
    longitude: float | None = None
    location_accuracy_m: float | None = None


class AttendanceOut(ORMModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    date: date
    clock_in_time: datetime
    clock_out_time: datetime | None = None
    status: str
    total_hours: float | None = None
    verification_method: str
    location_verified: bool
    verification_source: str
    clock_in_public_ip: str | None = None
    clock_in_local_ip: str | None = None
    clock_in_latitude: float | None = None
    clock_in_longitude: float | None = None


class EmployeeRef(ORMModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    agency: AgencyRef | None = None


class AttendanceWithEmployee(AttendanceOut):
    employee: EmployeeRef | None = None


# --- Profiles (admin users) -------------------------------------------------
class ProfileOut(ORMModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: Role
    created_at: datetime | None = None


# --- Push notifications ------------------------------------------------------
class PushTokenRegister(BaseModel):
    token: str
    platform: str | None = None


class AdminNotificationCreate(BaseModel):
    title: str
    body: str
    # Null or in the past = send immediately. In the future = scheduled.
    scheduled_for: datetime | None = None

    @field_validator("title", "body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("scheduled_for")
    @classmethod
    def _require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("scheduled_for must include a UTC offset (e.g. end with 'Z')")
        return value


class AdminNotificationOut(ORMModel):
    id: uuid.UUID
    title: str
    body: str
    created_by: str
    status: str
    scheduled_for: datetime | None = None
    sent_at: datetime | None = None
    recipient_count: int | None = None
    created_at: datetime


class ProfileRoleUpdate(BaseModel):
    role: Role


# --- Attendance QR ------------------------------------------------------------
class AttendanceQrOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token: str
    created_at: datetime | None = None
    rotated_by: str | None = None


# --- Reports ----------------------------------------------------------------
class AttendanceSummary(BaseModel):
    date: date
    present: int
    late: int
    total: int


class OverviewMetrics(BaseModel):
    employees: int
    agencies: int
    clocked_in_today: int
    late_today: int
