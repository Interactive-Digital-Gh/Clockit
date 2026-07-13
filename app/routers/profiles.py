"""Dashboard user (profile) management. Restricted to user-manager roles."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin, require_roles
from ..models import USER_MANAGER_ROLES, Profile
from ..schemas import ProfileOut, ProfileRoleUpdate

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db), _=Depends(require_roles(*USER_MANAGER_ROLES))):
    return db.scalars(select(Profile).order_by(Profile.created_at)).all()


@router.patch("/{profile_id}/role", response_model=ProfileOut)
def update_role(
    profile_id: uuid.UUID,
    body: ProfileRoleUpdate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_roles(*USER_MANAGER_ROLES)),
):
    if profile_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change your own role.")
    prof = db.get(Profile, profile_id)
    if not prof:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    prof.role = body.role
    db.commit()
    db.refresh(prof)
    return prof


@router.get("/me", response_model=ProfileOut)
def my_profile(admin: Profile = Depends(get_current_admin)):
    return admin
