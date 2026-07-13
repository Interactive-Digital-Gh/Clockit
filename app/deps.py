"""Auth dependencies: resolve the bearer token into a principal and enforce roles."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Employee, Profile
from .security import TYPE_ADMIN, TYPE_EMPLOYEE, decode_token

bearer = HTTPBearer(auto_error=True)


@dataclass
class Principal:
    type: str          # "employee" | "admin"
    employee: Employee | None = None
    profile: Profile | None = None


def get_principal(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Principal:
    payload = decode_token(creds.credentials)
    subject = payload.get("sub")
    token_type = payload.get("type")

    if token_type == TYPE_EMPLOYEE:
        emp = db.get(Employee, subject)
        if not emp or not emp.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Employee not found or inactive")
        return Principal(type=TYPE_EMPLOYEE, employee=emp)

    if token_type == TYPE_ADMIN:
        prof = db.get(Profile, subject)
        if not prof:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Profile not found")
        return Principal(type=TYPE_ADMIN, profile=prof)

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown token type")


def get_current_employee(principal: Principal = Depends(get_principal)) -> Employee:
    if principal.type != TYPE_EMPLOYEE or principal.employee is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employee token required")
    return principal.employee


def get_current_admin(principal: Principal = Depends(get_principal)) -> Profile:
    if principal.type != TYPE_ADMIN or principal.profile is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin (dashboard) token required")
    return principal.profile


def require_roles(*roles: str):
    """Dependency factory: admin token whose role is in `roles`."""

    def checker(admin: Profile = Depends(get_current_admin)) -> Profile:
        if admin.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires one of roles: {', '.join(roles)}",
            )
        return admin

    return checker
