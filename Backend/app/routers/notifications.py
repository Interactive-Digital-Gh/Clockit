"""Push token registration (mobile) and admin broadcast alerts (dashboard)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_employee, require_roles
from ..models import ADMIN_ROLES, AdminNotification, Employee, Profile, PushToken
from ..schemas import AdminNotificationCreate, AdminNotificationOut, PushTokenRegister
from ..services.push import dispatch_notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def register_push_token(
    body: PushTokenRegister,
    db: Session = Depends(get_db),
    emp: Employee = Depends(get_current_employee),
):
    """Registers (or re-homes) a device's Expo push token to this employee."""
    existing = db.scalar(select(PushToken).where(PushToken.token == body.token))
    if existing:
        existing.employee_id = emp.id
        existing.platform = body.platform
    else:
        db.add(PushToken(employee_id=emp.id, token=body.token, platform=body.platform))
    db.commit()


@router.post("", response_model=AdminNotificationOut, status_code=status.HTTP_201_CREATED)
def create_notification(
    body: AdminNotificationCreate,
    db: Session = Depends(get_db),
    admin: Profile = Depends(require_roles(*ADMIN_ROLES)),
):
    is_immediate = body.scheduled_for is None or body.scheduled_for <= datetime.now(timezone.utc)
    notification = AdminNotification(
        title=body.title,
        body=body.body,
        created_by=admin.email,
        scheduled_for=None if is_immediate else body.scheduled_for,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    if is_immediate:
        dispatch_notification(db, notification)

    return notification


@router.get("", response_model=list[AdminNotificationOut])
def list_notifications(db: Session = Depends(get_db), _=Depends(require_roles(*ADMIN_ROLES))):
    stmt = select(AdminNotification).order_by(AdminNotification.created_at.desc())
    return db.scalars(stmt).all()


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_roles(*ADMIN_ROLES)),
):
    notification = db.get(AdminNotification, notification_id)
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.status != "scheduled":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a pending scheduled notification can be canceled"
        )
    notification.status = "canceled"
    db.commit()
