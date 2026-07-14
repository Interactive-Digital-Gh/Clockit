"""Agency management. Reads: any admin. Writes: admin-tier roles."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin, get_current_employee, require_roles
from ..models import ADMIN_ROLES, VIEW_ALL_ROLES, Agency, Employee
from ..schemas import AgencyCreate, AgencyOut, AgencyUpdate

router = APIRouter(prefix="/agencies", tags=["agencies"])


@router.get("/me", response_model=AgencyOut)
def my_agency(db: Session = Depends(get_db), emp: Employee = Depends(get_current_employee)):
    """The signed-in employee's own agency (mobile Workplace screen + network rules)."""
    if not emp.agency_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not assigned to an agency yet")
    agency = db.get(Agency, emp.agency_id)
    if not agency:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agency not found")
    return agency


@router.get("", response_model=list[AgencyOut])
def list_agencies(db: Session = Depends(get_db), _=Depends(require_roles(*VIEW_ALL_ROLES))):
    return db.scalars(select(Agency).order_by(Agency.name)).all()


@router.get("/{agency_id}", response_model=AgencyOut)
def get_agency(
    agency_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(require_roles(*VIEW_ALL_ROLES))
):
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agency not found")
    return agency


@router.post("", response_model=AgencyOut, status_code=status.HTTP_201_CREATED)
def create_agency(
    body: AgencyCreate, db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))
):
    data = body.model_dump()
    if data.get("network_config") is not None:
        data["network_config"] = body.network_config.model_dump()
    agency = Agency(**data)
    db.add(agency)
    db.commit()
    db.refresh(agency)
    return agency


@router.patch("/{agency_id}", response_model=AgencyOut)
def update_agency(
    agency_id: uuid.UUID,
    body: AgencyUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agency not found")

    updates = body.model_dump(exclude_unset=True)
    if "network_config" in updates and body.network_config is not None:
        updates["network_config"] = body.network_config.model_dump()
    for key, value in updates.items():
        setattr(agency, key, value)

    db.commit()
    db.refresh(agency)
    return agency
