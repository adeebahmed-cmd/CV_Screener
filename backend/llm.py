import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Optional

import google.generativeai as genai
from dotenv import load_dotenv

log = logging.getLogger(__name__)

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = "gemini-2.5-flash-lite"
model = genai.GenerativeModel(GEMINI_MODEL)


class LLMError(RuntimeError):
    pass


def run_llm(prompt: str, max_output_tokens: int = 4096) -> str:
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            top_p=0.9,
            response_mime_type="application/json",
            max_output_tokens=max_output_tokens,
        ),
    )
    return response.text


def _extract_json(raw: str) -> Any:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)


def _likely_truncated_json(raw: str, error: json.JSONDecodeError) -> bool:
    msg = str(error)
    text = raw.rstrip()
    if "Unterminated string" in msg:
        return True
    if "Expecting value" in msg or "Expecting ',' delimiter" in msg:
        return text.endswith(("{", "[", ":", ",", "\""))
    return not text.endswith(("}", "]"))


def _is_quota_error(message: str) -> bool:
    low = message.lower()
    return (
        "429" in low
        and (
            "quota exceeded" in low
            or "rate limit" in low
            or "generate_content_free_tier_requests" in low
        )
    )


def _friendly_quota_error(message: str) -> str:
    retry_match = re.search(r"Please retry in\s+([0-9.]+)s", message, re.IGNORECASE)
    if not retry_match:
        retry_match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", message, re.IGNORECASE)
    retry_hint = ""
    if retry_match:
        retry_hint = f" Retry after about {round(float(retry_match.group(1)))} seconds."
    return (
        f"Gemini quota exceeded for model '{GEMINI_MODEL}'."
        f"{retry_hint} Reduce repeated analyze/rank calls or upgrade Google AI Studio billing."
    )


async def call_llm_json(prompt: str, max_output_tokens: int = 4096, retries: int = 2) -> Any:
    """Call Gemini through run_llm and return parsed JSON."""
    if not os.getenv("GOOGLE_API_KEY"):
        raise LLMError("GOOGLE_API_KEY is not set.")

    last_err: Optional[Exception] = None
    current_max_output_tokens = max_output_tokens

    for attempt in range(retries + 1):
        try:
            raw = await asyncio.to_thread(run_llm, prompt, current_max_output_tokens)
            if not raw:
                raise LLMError("Empty response from Gemini.")
            try:
                return _extract_json(raw)
            except json.JSONDecodeError as e:
                last_err = LLMError(f"Invalid JSON from model: {e}. Raw: {raw[:500]}")
                if _likely_truncated_json(raw, e):
                    current_max_output_tokens = min(current_max_output_tokens * 2, 8192)
                log.warning("Attempt %s: invalid JSON, retrying", attempt + 1)
        except Exception as e:
            if _is_quota_error(str(e)):
                raise LLMError(_friendly_quota_error(str(e))) from e
            last_err = e
            log.warning("Attempt %s: LLM error %s", attempt + 1, e)
        if attempt < retries:
            await asyncio.sleep(1 + attempt)

    raise LLMError(f"LLM call failed after {retries + 1} attempts with Gemini. Last error: {last_err}")


async def ping_llm() -> tuple[bool, list[str], Optional[str]]:
    if not os.getenv("GOOGLE_API_KEY"):
        return False, [], "GOOGLE_API_KEY is not set."
    try:
        await asyncio.wait_for(
            asyncio.to_thread(run_llm, "Return only this JSON: {\"ok\": true}", 64),
            timeout=20,
        )
        return True, [GEMINI_MODEL], None
    except asyncio.TimeoutError:
        return False, [GEMINI_MODEL], "Gemini health check timed out."
    except Exception as e:
        return False, [GEMINI_MODEL], str(e)
