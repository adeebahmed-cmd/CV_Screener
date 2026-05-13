"""
User management routes — Admin only.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from db import get_db
from models import User

router = APIRouter(prefix="/api/users", tags=["users"])


class RoleUpdate(BaseModel):
    role: str   # "admin" | "recruiter"


def _serialize(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "picture": u.picture,
        "role": u.role,
        "created_at": u.created_at.isoformat(),
    }


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    _: Optional[User] = Depends(require_admin),
):
    return [_serialize(u) for u in db.query(User).order_by(User.created_at).all()]


@router.put("/{user_id}/role")
def update_role(
    user_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_admin),
):
    if body.role not in ("admin", "recruiter"):
        raise HTTPException(400, "Role must be 'admin' or 'recruiter'")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    # Prevent demoting yourself
    if current_user and user.id == current_user.id and body.role != "admin":
        raise HTTPException(400, "You cannot demote your own account")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return _serialize(user)
