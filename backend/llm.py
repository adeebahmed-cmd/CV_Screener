import asyncio
import json
import logging
import os
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def get_ollama_url() -> str:
    return os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")


def get_ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL", "phi3:mini").strip() or "phi3:mini"


def get_ranking_model() -> str:
    ranking = os.getenv("RANKING_MODEL", "").strip()
    return ranking if ranking else get_ollama_model()


def get_jd_model() -> str:
    """Model used for JD analysis. Defaults to phi3:mini for better extraction accuracy.
    Override with JD_MODEL env var if needed."""
    jd = os.getenv("JD_MODEL", "").strip()
    return jd if jd else "phi3:mini"


async def _call_ollama(
    method: str,
    path: str,
    payload: Optional[dict[str, Any]] = None,
    timeout: float = 180.0,
    timeout_msg: str = "Ollama request timed out. The model may still be loading into memory.",
) -> dict[str, Any]:
    url = f"{get_ollama_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "GET":
                response = await client.get(url)
            else:
                response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.ConnectError as e:
        raise LLMError(
            f"Could not connect to Ollama at {get_ollama_url()}. Make sure Ollama is running."
        ) from e
    except httpx.HTTPStatusError as e:
        detail = ""
        try:
            body = e.response.json()
            detail = body.get("error") or json.dumps(body)
        except Exception:
            detail = e.response.text
        raise LLMError(f"Ollama request failed: {detail or e}") from e
    except httpx.TimeoutException as e:
        raise LLMError(timeout_msg) from e
    except Exception as e:
        raise LLMError(f"Unexpected Ollama error: {e}") from e

    if isinstance(data, dict) and data.get("error"):
        raise LLMError(str(data["error"]))
    return data


async def _post_ollama_json(path: str, payload: dict[str, Any], timeout: float = 180.0) -> dict[str, Any]:
    return await _call_ollama("POST", path, payload=payload, timeout=timeout)


async def _get_ollama_json(path: str, timeout: float = 20.0) -> dict[str, Any]:
    return await _call_ollama(
        "GET", path, timeout=timeout, timeout_msg="Ollama health check timed out."
    )


def _extract_json(raw: str) -> Any:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # If the LLM prefixed the JSON with prose, find the first JSON structure.
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start != -1:
            end = text.rfind(end_char)
            if end != -1 and end > start:
                return json.loads(text[start: end + 1])
    return json.loads(text)


async def call_llm_json(prompt: str, max_output_tokens: int = 4096, retries: int = 2, model: Optional[str] = None, timeout: float = 360.0) -> Any:
    last_err: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            data = await _post_ollama_json(
                "/api/generate",
                {
                    "model": model or get_ollama_model(),
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "keep_alive": "30m",  # keep model loaded for 30 min after last use
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "num_predict": max_output_tokens,
                    },
                },
                timeout=timeout,
            )
            raw = (data.get("response") or "").strip()
            if not raw:
                raise LLMError("Empty response from Ollama.")
            return _extract_json(raw)
        except (json.JSONDecodeError, LLMError) as e:
            last_err = e
            log.warning("Attempt %s: LLM error %s", attempt + 1, e)
        except Exception as e:
            last_err = e
            log.warning("Attempt %s: unexpected LLM error %s", attempt + 1, e)

        if attempt < retries:
            await asyncio.sleep(1 + attempt)

    raise LLMError(f"LLM call failed after {retries + 1} attempts with Ollama. Last error: {last_err}")


async def warmup_model(model: str) -> None:
    """Send an empty prompt to pre-load *model* into Ollama memory.
    Errors are logged but never raised — warmup is best-effort.
    """
    log.info("warmup_model starting model=%s", model)
    try:
        await _post_ollama_json(
            "/api/generate",
            {"model": model, "prompt": "", "stream": False, "keep_alive": "30m"},
            timeout=180.0,
        )
        log.info("warmup_model done model=%s", model)
    except Exception as e:
        log.warning("warmup_model failed model=%s error=%s", model, e)


async def ping_llm() -> tuple[bool, list[str], Optional[str]]:
    try:
        data = await _get_ollama_json("/api/tags", timeout=20.0)
    except LLMError as e:
        return False, [], str(e)

    models = []
    for item in data.get("models", []):
        name = item.get("name")
        if name:
            models.append(name)

    configured_model = get_ollama_model()
    if configured_model not in models:
        return (
            False,
            models,
            f"Configured model '{configured_model}' is not pulled in Ollama.",
        )
    return True, models, None
