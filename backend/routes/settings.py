from fastapi import APIRouter

from llm import GEMINI_MODEL, ping_llm
from schemas import SettingsPayload

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    return {
        "model": GEMINI_MODEL,
    }


@router.put("/settings")
def update_settings(payload: SettingsPayload):
    return {"model": GEMINI_MODEL}


@router.get("/health/llm")
async def health_llm():
    ok, models, err = await ping_llm()
    return {"ok": ok, "models_available": models, "error": err}
