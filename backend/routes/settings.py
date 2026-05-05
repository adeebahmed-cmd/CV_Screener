import os

from dotenv import set_key
from fastapi import APIRouter

from config import ENV_FILE
from llm import get_ollama_model, get_ollama_url, get_ranking_model, ping_llm
from schemas import SettingsPayload

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    return {
        "ollama_url": get_ollama_url(),
        "model": get_ollama_model(),
        "ranking_model": os.getenv("RANKING_MODEL", ""),
    }


@router.put("/settings")
def update_settings(payload: SettingsPayload):
    updates = {}

    if payload.ollama_url is not None and payload.ollama_url.strip():
        updates["OLLAMA_URL"] = payload.ollama_url.strip()
    if payload.model is not None and payload.model.strip():
        updates["OLLAMA_MODEL"] = payload.model.strip()
    if payload.ranking_model is not None:
        updates["RANKING_MODEL"] = payload.ranking_model.strip()

    for key, value in updates.items():
        os.environ[key] = value
        set_key(str(ENV_FILE), key, value)

    return {
        "ollama_url": get_ollama_url(),
        "model": get_ollama_model(),
        "ranking_model": os.getenv("RANKING_MODEL", ""),
    }


@router.get("/health/ollama")
async def health_ollama():
    ok, models, err = await ping_llm()
    return {"ok": ok, "models_available": models, "error": err}


@router.get("/health/llm")
async def health_llm():
    return await health_ollama()
