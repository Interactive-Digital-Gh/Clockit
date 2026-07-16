"""Employee management. Reads: any admin. Writes: admin-tier roles."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_admin, get_current_employee, require_roles
from ..models import ADMIN_ROLES, VIEW_ALL_ROLES, Employee
from ..schemas import EmployeeCreate, EmployeeOut, EmployeeSelfUpdate, EmployeeUpdate

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/me", response_model=EmployeeOut)
def my_employee(db: Session = Depends(get_db), emp: Employee = Depends(get_current_employee)):
    """The signed-in employee's own full record (mobile app)."""
    return db.scalar(
        select(Employee).options(joinedload(Employee.agency)).where(Employee.id == emp.id)
    )


@router.patch("/me", response_model=EmployeeOut)
def update_my_employee(
    body: EmployeeSelfUpdate,
    db: Session = Depends(get_db),
    emp: Employee = Depends(get_current_employee),
):
    """Self-service: set your name/department during mobile onboarding.
    A non-empty job_title also marks the account as onboarded — sign-ins
    with it skip the onboarding screen."""
    if body.name and body.name.strip():
        emp.name = body.name.strip()
    if body.job_title and body.job_title.strip():
        emp.job_title = body.job_title.strip()
    db.commit()
    return db.scalar(
        select(Employee).options(joinedload(Employee.agency)).where(Employee.id == emp.id)
    )


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    db: Session = Depends(get_db),
    _=Depends(require_roles(*VIEW_ALL_ROLES)),
    search: str | None = Query(None, description="Match name/email/emp_id"),
    agency_id: uuid.UUID | None = None,
    is_active: bool | None = None,
):
    stmt = select(Employee).options(joinedload(Employee.agency)).order_by(Employee.name)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(Employee.name.ilike(like), Employee.email.ilike(like), Employee.emp_id.ilike(like))
        )
    if agency_id is not None:
        stmt = stmt.where(Employee.agency_id == agency_id)
    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
    return db.scalars(stmt).all()


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(require_roles(*VIEW_ALL_ROLES))
):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    return emp


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    body: EmployeeCreate, db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))
):
    emp = Employee(**body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp
