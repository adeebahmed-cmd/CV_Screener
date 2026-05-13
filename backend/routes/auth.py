"""
Auth routes — password login, Google SSO login, current-user lookup.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import create_jwt, get_current_user, verify_google_token
from config import ADMIN_PASSWORD, AUTH_ENABLED, AUTH_TYPE, GOOGLE_CLIENT_ID
from db import get_db
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PasswordLoginRequest(BaseModel):
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str   # ID token from Google Sign-In button


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_dict(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name,
            "picture": user.picture, "role": user.role}


def _get_or_create_local_admin(db: Session, email: str, name: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        is_first = db.query(User).count() == 0
        user = User(email=email, name=name, role="admin" if is_first else "recruiter")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/config")
def auth_config():
    """Tell the frontend which auth method is active."""
    return {
        "enabled": AUTH_ENABLED,
        "type": AUTH_TYPE,           # "none" | "password" | "google"
        "google_client_id": GOOGLE_CLIENT_ID if AUTH_TYPE == "google" else "",
    }


@router.post("/password")
def password_login(body: PasswordLoginRequest, db: Session = Depends(get_db)):
    """Simple password login — password must match ADMIN_PASSWORD in .env."""
    if AUTH_TYPE != "password":
        raise HTTPException(400, "Password auth is not enabled")
    if not ADMIN_PASSWORD or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Incorrect password")

    user = _get_or_create_local_admin(db, "admin@local", "Admin")
    token = create_jwt(user.id)
    log.info("auth password_login user_id=%s", user.id)
    return {"token": token, "user": _user_dict(user)}


@router.post("/google")
def google_login(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Verify a Google credential, create/update the user, return a JWT."""
    claims = verify_google_token(body.credential)
    email: str = claims.get("email", "")
    if not email:
        raise HTTPException(400, "Google token missing email")

    user = db.query(User).filter(User.email == email).first()
    is_first = db.query(User).count() == 0
    if not user:
        user = User(email=email, name=claims.get("name", email),
                    picture=claims.get("picture"),
                    role="admin" if is_first else "recruiter")
        db.add(user)
        log.info("auth new_user email=%s role=%s", email, user.role)
    else:
        user.name = claims.get("name", user.name)
        user.picture = claims.get("picture", user.picture)

    db.commit()
    db.refresh(user)
    token = create_jwt(user.id)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
def get_me(current_user: Optional[User] = Depends(get_current_user)):
    """Return the current user, or a guest object if auth is disabled."""
    if not AUTH_ENABLED:
        return {"id": 0, "email": "local@machine", "name": "Local User",
                "picture": None, "role": "admin"}
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return _user_dict(current_user)
