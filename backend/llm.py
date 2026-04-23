import asyncio
import json
import logging
from typing import Any, Optional

import httpx

from config import OLLAMA_MODEL, OLLAMA_URL

log = logging.getLogger(__name__)


class OllamaError(RuntimeError):
    pass


async def _get_settings() -> tuple[str, str]:
    """Read the latest URL/model from DB, falling back to env defaults."""
    try:
        from db import SessionLocal
        from models import Setting

        db = SessionLocal()
        try:
            url_row = db.query(Setting).filter(Setting.key == "ollama_url").first()
            model_row = db.query(Setting).filter(Setting.key == "model").first()
            url = url_row.value if url_row else OLLAMA_URL
            model = model_row.value if model_row else OLLAMA_MODEL
            return url, model
        finally:
            db.close()
    except Exception:
        return OLLAMA_URL, OLLAMA_MODEL


async def call_ollama(prompt: str, model: Optional[str] = None) -> Any:
    """Call Ollama /api/generate with format=json. Retries 3x. Returns parsed JSON."""
    url, default_model = await _get_settings()
    model_name = model or default_model
    last_err: Optional[Exception] = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                r = await client.post(
                    f"{url.rstrip('/')}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0.2},
                    },
                )
                r.raise_for_status()
                payload = r.json()
                raw = payload.get("response", "")
                if not raw:
                    raise OllamaError("Empty response from Ollama.")
                try:
                    return json.loads(raw)
                except json.JSONDecodeError as e:
                    last_err = OllamaError(f"Invalid JSON from model: {e}. Raw: {raw[:500]}")
                    log.warning("Attempt %s: invalid JSON, retrying", attempt + 1)
        except httpx.HTTPError as e:
            last_err = OllamaError(f"Ollama HTTP error: {e}")
            log.warning("Attempt %s: HTTP error %s", attempt + 1, e)
        await asyncio.sleep(1 + attempt)

    raise OllamaError(
        f"LLM call failed after 3 attempts. Is Ollama running at {url} with model '{model_name}'? "
        f"Last error: {last_err}"
    )


async def ping_ollama() -> tuple[bool, list[str], Optional[str]]:
    url, _ = await _get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{url.rstrip('/')}/api/tags")
            r.raise_for_status()
            data = r.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return True, models, None
    except Exception as e:
        return False, [], str(e)
