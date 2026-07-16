"""SQLAlchemy 2.0 models — the single source of truth for the schema.

Mirrors the tables the mobile app and dashboard used on Supabase, minus
Supabase-specific auth/RLS. Google identity is linked via `google_sub`.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Roles (mirrors Dashboard/lib/types.ts)
ROLE_SUPER_ADMIN = "super_admin"
ROLE_IT = "it"
ROLE_HR = "hr"
ROLE_FRONT_DESK = "front_desk"
# Regular staff: dashboard shows only their own attendance. Default for
# new sign-ups until promoted.
ROLE_EMPLOYEE = "employee"
ALL_ROLES = (ROLE_SUPER_ADMIN, ROLE_IT, ROLE_HR, ROLE_FRONT_DESK, ROLE_EMPLOYEE)
# Roles allowed to browse other people's attendance/employee data.
VIEW_ALL_ROLES = (ROLE_SUPER_ADMIN, ROLE_IT, ROLE_HR, ROLE_FRONT_DESK)
ADMIN_ROLES = (ROLE_SUPER_ADMIN, ROLE_IT, ROLE_HR)
USER_MANAGER_ROLES = (ROLE_SUPER_ADMIN, ROLE_IT)


class Agency(Base):
    __tablename__ = "agencies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    agency_code: Mapped[str | None] = mapped_column(String)
    address: Mapped[str | None] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # { allowed_subnets: [...], allowed_ssids: [...], description: "..." }
    network_config: Mapped[dict | None] = mapped_column(JSONB)
    # Email domains that map to this agency, e.g. ["interactivedigital.com"]
    email_domains: Mapped[list | None] = mapped_column(JSONB)

    employees: Mapped[list["Employee"]] = relationship(back_populates="agency")


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, index=True)
    emp_id: Mapped[str | None] = mapped_column(String)
    job_title: Mapped[str | None] = mapped_column(String)
    employment_type: Mapped[str | None] = mapped_column(String)
    date_join: Mapped[date | None] = mapped_column(Date)
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="SET NULL")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Linked Google identity ("sub" claim). Null = pre-registered by HR,
    # not yet claimed on first sign-in.
    google_sub: Mapped[str | None] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    agency: Mapped["Agency | None"] = relationship(back_populates="employees")
    attendance: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    clock_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'present'"))
    total_hours: Mapped[float | None] = mapped_column(Numeric(6, 2))
    verification_method: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'manual'")
    )
    # Was this clock-in made from the office network?
    location_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Which signal matched: 'office_ip' | 'office_subnet' | 'off_site'
    # (leaves room for a future 'office_qr' factor without a schema change).
    verification_source: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'off_site'")
    )
    # Audit: what the server observed vs what the device reported.
    clock_in_public_ip: Mapped[str | None] = mapped_column(String)
    clock_in_local_ip: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    employee: Mapped["Employee"] = relationship(back_populates="attendance")

    __table_args__ = (
        # One attendance row per employee per day.
        CheckConstraint("clock_out_time IS NULL OR clock_out_time >= clock_in_time",
                        name="attendance_clockout_after_clockin"),
    )


class AttendanceQr(Base):
    """The rotating attendance QR token. The newest row is the active one;
    older rows are kept as an audit trail of rotations."""

    __tablename__ = "attendance_qr_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    token: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    rotated_by: Mapped[str | None] = mapped_column(String)  # profile email, for the audit trail


class Profile(Base):
    """Dashboard admin user with a role. Distinct from Employee."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    full_name: Mapped[str | None] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'employee'"))
    google_sub: Mapped[str | None] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "role in ('super_admin', 'it', 'hr', 'front_desk', 'employee')",
            name="profiles_role_check",
        ),
    )
