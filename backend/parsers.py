import io
import re
from pathlib import Path
from typing import Optional

import pdfplumber
from docx import Document

from config import MAX_FILE_MB

MAX_BYTES = MAX_FILE_MB * 1024 * 1024

_HEADER_WORDS = {
    "curriculum", "curriculum vitae", "resume", "cv", "profile",
    "personal details", "personal information", "bio-data", "biodata",
}

_PROFILE_HINTS = (
    "summary", "profile", "experience", "employment", "work history", "skills",
    "competencies", "expertise", "responsibilities", "achievements", "education",
    "certification", "certifications", "projects", "leadership", "tools", "languages",
)

_PROFILE_KEYWORDS = (
    "experience", "years", "skill", "skills", "managed", "management", "lead", "led",
    "director", "program", "project", "therapy", "rehabilitation", "clinical", "health",
    "operations", "budget", "training", "compliance", "evaluation", "partnership",
    "certified", "certification", "master", "bachelor", "phd", "mba",
)


class ParseError(ValueError):
    pass


def _clean(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf(data: bytes) -> str:
    pages = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return _clean("\n\n".join(pages))


def parse_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return _clean("\n".join(parts))


def parse_txt(data: bytes) -> str:
    try:
        return _clean(data.decode("utf-8"))
    except UnicodeDecodeError:
        return _clean(data.decode("latin-1", errors="ignore"))


def extract_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise ParseError(f"File exceeds {MAX_FILE_MB} MB limit.")
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return parse_pdf(data)
    if ext == ".docx":
        return parse_docx(data)
    if ext == ".txt":
        return parse_txt(data)
    raise ParseError(f"Unsupported file type: {ext}. Use PDF, DOCX, or TXT.")


def guess_candidate_name(text: str, fallback_filename: Optional[str] = None) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        low = stripped.lower()
        if any(low.startswith(h) or low == h for h in _HEADER_WORDS):
            continue
        if len(stripped) > 80:
            continue
        if re.search(r"\d{5,}", stripped):
            continue
        if "@" in stripped or "http" in low:
            continue
        return stripped
    if fallback_filename:
        return Path(fallback_filename).stem
    return "Unknown Candidate"


def build_candidate_profile(text: str, max_chars: int = 5500) -> str:
    lines = [line.strip(" -\t") for line in text.splitlines()]
    lines = [line for line in lines if line]

    selected: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        low = line.lower()
        if low in seen:
            return
        if "@" in line or "http" in low:
            return
        if re.search(r"\+?\d[\d\s().-]{7,}\d", line):
            return
        seen.add(low)
        selected.append(line)

    for line in lines[:12]:
        if len(line) <= 160:
            add(line)

    for idx, line in enumerate(lines):
        low = line.lower()
        if any(hint in low for hint in _PROFILE_HINTS):
            add(line)
            for follow in lines[idx + 1: idx + 5]:
                if len(follow) <= 180:
                    add(follow)

    for line in lines:
        low = line.lower()
        if any(keyword in low for keyword in _PROFILE_KEYWORDS):
            add(line)

    profile = "\n".join(selected)
    if len(profile) <= max_chars:
        return profile

    trimmed: list[str] = []
    total = 0
    for line in selected:
        extra = len(line) + (1 if trimmed else 0)
        if total + extra > max_chars:
            break
        trimmed.append(line)
        total += extra
    return "\n".join(trimmed)
