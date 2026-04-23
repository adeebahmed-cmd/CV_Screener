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
