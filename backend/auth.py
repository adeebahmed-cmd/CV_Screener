"""
Auth utilities — Google token verification + JWT issuance + FastAPI dependency.

When AUTH_ENABLED is False (no GOOGLE_CLIENT_ID in .env) every dependency
returns None and all routes are publicly accessible, preserving the existing
single-user behaviour.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import AUTH_ENABLED, GOOGLE_CLIENT_ID, JWT_ALGORITHM, JWT_EXPIRE_DAYS, JWT_SECRET
from db import get_db
from models import User

log = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_jwt(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Google ID-token verification
# ---------------------------------------------------------------------------

def verify_google_token(credential: str) -> dict:
    """Verify a Google Sign-In credential (ID token) and return its claims."""
    if not AUTH_ENABLED:
        raise HTTPException(400, "Auth is not enabled — set GOOGLE_CLIENT_ID in .env")
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as grequests
        claims = id_token.verify_oauth2_token(credential, grequests.Request(), GOOGLE_CLIENT_ID)
        return claims
    except Exception as exc:
        log.warning("Google token verification failed: %s", exc)
        raise HTTPException(401, "Invalid Google credential")


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the authenticated User, or None if auth is disabled."""
    if not AUTH_ENABLED:
        return None
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = _decode_jwt(credentials.credentials)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_admin(user: Optional[User] = Depends(get_current_user)) -> Optional[User]:
    """Raise 403 if auth is enabled and caller is not an admin."""
    if AUTH_ENABLED and (not user or user.role != "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user
