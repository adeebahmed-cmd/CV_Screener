"""
Keyword Repository routes — central governed keyword store.

Recruiters:  GET (approved), POST (creates as pending)
Admins:      GET (all), POST (creates as approved), PUT, DELETE
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from config import AUTH_ENABLED
from db import get_db
from models import KeywordEntry, User

router = APIRouter(prefix="/api/repository", tags=["repository"])
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class KeywordCreate(BaseModel):
    keyword: str
    category: str
    weight: float = 5.0
    kw_type: str = "good-to-have"
    synonyms: List[str] = []


class KeywordUpdate(BaseModel):
    keyword: Optional[str] = None
    category: Optional[str] = None
    weight: Optional[float] = None
    kw_type: Optional[str] = None
    synonyms: Optional[List[str]] = None
    status: Optional[str] = None   # admin-only field


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(k: KeywordEntry) -> dict:
    return {
        "id": k.id,
        "keyword": k.keyword,
        "category": k.category,
        "weight": k.weight,
        "kw_type": k.kw_type,
        "synonyms": k.synonyms or [],
        "status": k.status,
        "created_by": k.created_by.name if k.created_by else None,
        "created_at": k.created_at.isoformat(),
    }


def _is_admin(user: Optional[User]) -> bool:
    if not AUTH_ENABLED:
        return True  # no auth — treat everyone as admin
    return user is not None and user.role == "admin"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
def list_keywords(
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    q = db.query(KeywordEntry)
    if not _is_admin(current_user):
        # Recruiters see only approved keywords + their own pending
        from sqlalchemy import or_
        q = q.filter(
            or_(
                KeywordEntry.status == "approved",
                KeywordEntry.created_by_id == current_user.id,
            )
        )
    if status:
        q = q.filter(KeywordEntry.status == status)
    if category:
        q = q.filter(KeywordEntry.category == category)
    return [_serialize(k) for k in q.order_by(KeywordEntry.category, KeywordEntry.keyword).all()]


@router.post("")
def create_keyword(
    body: KeywordCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    kw = body.keyword.strip()
    if not kw:
        raise HTTPException(400, "Keyword cannot be empty")

    # Admins create as approved; recruiters create as pending
    initial_status = "approved" if _is_admin(current_user) else "pending"
    user_id = current_user.id if current_user else None

    entry = KeywordEntry(
        keyword=kw,
        category=body.category,
        weight=body.weight,
        kw_type=body.kw_type,
        synonyms=body.synonyms,
        status=initial_status,
        created_by_id=user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log.info("repository create keyword=%s status=%s user=%s", kw, initial_status, user_id)
    return _serialize(entry)


@router.put("/{keyword_id}")
def update_keyword(
    keyword_id: int,
    body: KeywordUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    entry = db.query(KeywordEntry).filter(KeywordEntry.id == keyword_id).first()
    if not entry:
        raise HTTPException(404, "Keyword not found")

    # Only admins can approve/change status
    if body.status is not None and not _is_admin(current_user):
        raise HTTPException(403, "Only admins can change keyword status")

    if body.keyword is not None:
        entry.keyword = body.keyword.strip()
    if body.category is not None:
        entry.category = body.category
    if body.weight is not None:
        entry.weight = body.weight
    if body.kw_type is not None:
        entry.kw_type = body.kw_type
    if body.synonyms is not None:
        entry.synonyms = body.synonyms
    if body.status is not None:
        entry.status = body.status
        if body.status == "approved" and current_user:
            entry.approved_by_id = current_user.id

    db.commit()
    db.refresh(entry)
    return _serialize(entry)


@router.delete("/{keyword_id}")
def delete_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    _: Optional[User] = Depends(require_admin),
):
    entry = db.query(KeywordEntry).filter(KeywordEntry.id == keyword_id).first()
    if not entry:
        raise HTTPException(404, "Keyword not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
