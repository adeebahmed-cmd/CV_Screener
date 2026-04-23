from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import OLLAMA_MODEL, OLLAMA_URL
from db import get_db
from llm import ping_ollama
from models import Setting
from schemas import SettingsPayload

router = APIRouter(prefix="/api", tags=["settings"])


def _get(db: Session, key: str, default: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return {
        "ollama_url": _get(db, "ollama_url", OLLAMA_URL),
        "model": _get(db, "model", OLLAMA_MODEL),
    }


@router.put("/settings")
def update_settings(payload: SettingsPayload, db: Session = Depends(get_db)):
    _set(db, "ollama_url", payload.ollama_url)
    _set(db, "model", payload.model)
    db.commit()
    return {"ollama_url": payload.ollama_url, "model": payload.model}


@router.get("/health/ollama")
async def health_ollama():
    ok, models, err = await ping_ollama()
    return {"ok": ok, "models_available": models, "error": err}
