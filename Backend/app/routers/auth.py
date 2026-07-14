"""Authentication: Google sign-in for employees (mobile) and admins (dashboard)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import Principal, get_principal
from ..models import Employee, Profile
from ..schemas import AccessToken, DevLogin, GoogleLogin, Me, RefreshRequest, TokenPair
from ..security import (
    TYPE_ADMIN,
    TYPE_EMPLOYEE,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_google_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _tokens(subject: str, token_type: str, extra: dict) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(subject, token_type, extra),
        refresh_token=create_refresh_token(subject, token_type),
    )


def _login_employee(db: Session, identity: dict) -> TokenPair:
    """Link Google identity, claiming an HR pre-registered row by email if
    present, otherwise self-register a new employee."""
    emp = db.scalar(select(Employee).where(Employee.google_sub == identity["sub"]))
    if emp is None:
        emp = db.scalar(
            select(Employee).where(
                Employee.google_sub.is_(None),
                func.lower(Employee.email) == identity["email"],
            )
        )
        if emp is not None:
            emp.google_sub = identity["sub"]
        else:
            emp = Employee(
                name=identity["name"],
                email=identity["email"],
                google_sub=identity["sub"],
                is_active=True,
            )
            db.add(emp)
        db.commit()
        db.refresh(emp)

    return _tokens(
        str(emp.id), TYPE_EMPLOYEE, {"agency_id": str(emp.agency_id) if emp.agency_id else None}
    )


def _login_admin(db: Session, identity: dict) -> TokenPair:
    """First-ever profile becomes super_admin; everyone after defaults to
    front_desk (least privilege) and must be promoted."""
    prof = db.scalar(select(Profile).where(Profile.google_sub == identity["sub"]))
    if prof is None:
        prof = db.scalar(select(Profile).where(func.lower(Profile.email) == identity["email"]))
        if prof is not None:
            prof.google_sub = identity["sub"]
        else:
            is_first = db.scalar(select(func.count()).select_from(Profile)) == 0
            prof = Profile(
                email=identity["email"],
                full_name=identity["name"],
                google_sub=identity["sub"],
                role="super_admin" if is_first else "front_desk",
            )
            db.add(prof)
        db.commit()
        db.refresh(prof)

    return _tokens(str(prof.id), TYPE_ADMIN, {"role": prof.role})


@router.post("/google/employee", response_model=TokenPair)
def login_employee(body: GoogleLogin, db: Session = Depends(get_db)) -> TokenPair:
    """Mobile sign-in with a Google ID token."""
    return _login_employee(db, verify_google_id_token(body.id_token))


@router.post("/google/admin", response_model=TokenPair)
def login_admin(body: GoogleLogin, db: Session = Depends(get_db)) -> TokenPair:
    """Dashboard sign-in with a Google ID token."""
    return _login_admin(db, verify_google_id_token(body.id_token))


@router.post("/dev-login", response_model=TokenPair)
def dev_login(body: DevLogin, db: Session = Depends(get_db)) -> TokenPair:
    """LOCAL DEV ONLY — mint tokens without Google. Enabled only when
    DEV_MODE=true; returns 404 otherwise so it is invisible in production."""
    if not settings.dev_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    identity = {
        "sub": f"dev:{body.as_type}:{body.email.lower()}",
        "email": body.email.lower(),
        "name": body.name or body.email.split("@")[0],
    }
    if body.as_type == "employee":
        return _login_employee(db, identity)
    return _login_admin(db, identity)


@router.post("/refresh", response_model=AccessToken)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> AccessToken:
    payload = decode_refresh_token(body.refresh_token)
    subject, token_type = payload["sub"], payload["type"]

    if token_type == TYPE_EMPLOYEE:
        emp = db.get(Employee, subject)
        if not emp or not emp.is_active:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Employee not found or inactive")
        extra = {"agency_id": str(emp.agency_id) if emp.agency_id else None}
    else:
        prof = db.get(Profile, subject)
        if not prof:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Profile not found")
        extra = {"role": prof.role}

    return AccessToken(access_token=create_access_token(subject, token_type, extra))


@router.get("/me", response_model=Me)
def me(principal: Principal = Depends(get_principal)) -> Me:
    if principal.type == TYPE_EMPLOYEE:
        e = principal.employee
        return Me(type="employee", id=e.id, email=e.email, name=e.name, agency_id=e.agency_id)
    p = principal.profile
    return Me(type="admin", id=p.id, email=p.email, name=p.full_name, role=p.role)
