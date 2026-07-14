"""Pydantic v2 request/response schemas."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
    allowed_ssids: list[str] = Field(default_factory=list)
    description: str | None = None


class AgencyBase(BaseModel):
    name: str
    agency_code: str | None = None
    address: str | None = None
    is_active: bool = True
    network_config: NetworkConfig | None = None
    email_domains: list[str] | None = None


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: str | None = None
    agency_code: str | None = None
    address: str | None = None
    is_active: bool | None = None
    network_config: NetworkConfig | None = None
    email_domains: list[str] | None = None


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


class EmployeeOut(ORMModel, EmployeeBase):
    id: uuid.UUID
    agency: AgencyRef | None = None


# --- Attendance -------------------------------------------------------------
class ClockInRequest(BaseModel):
    # Device-reported LAN IP, validated against the agency's allowed subnets.
    local_ip: str | None = None


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


class ProfileRoleUpdate(BaseModel):
    role: Role


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
