import json
import logging
import math
import re
from collections import defaultdict
from time import perf_counter
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db import get_db
from llm import LLMError, call_llm_json, get_jd_model
from models import BulkRanking, CV, CandidateDecision, DetailedEvaluation, Job, LLMLog
from parsers import ParseError, augment_keywords, build_candidate_profile, extract_text, guess_candidate_name
from prompts import JD_ANALYSIS_PROMPT
from schemas import AnalyzeJDRequest, JobCreate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
log = logging.getLogger(__name__)

MAX_CV_UPLOAD = 50       # per-request upload ceiling (frontend batches larger sets)


# ---------------------------------------------------------------------------
# Synonym groups — each set contains terms treated as equivalent concepts.
# Covers common HR, NGO, health, finance, and operations vocabulary.
# ---------------------------------------------------------------------------
_SYNONYM_GROUPS: list[set[str]] = [
    # Finance & Governance
    {"budget management", "financial management", "fiscal management", "cost management",
     "budgeting", "budget planning", "budget control", "financial planning"},
    {"financial reporting", "financial statements", "accounts reporting", "financial analysis"},
    {"fundraising", "resource mobilization", "resource mobilisation", "grant writing",
     "proposal writing", "fund development", "grant management"},
    {"procurement", "supply chain", "supply chain management", "logistics", "sourcing"},
    {"audit", "auditing", "internal audit", "financial audit", "compliance audit"},

    # Leadership & Management
    {"leadership", "team lead", "team leader", "people management", "staff management",
     "team management", "managerial", "line management"},
    {"project management", "programme management", "program management",
     "project coordination", "project planning", "project delivery"},
    {"stakeholder management", "stakeholder engagement", "stakeholder relations",
     "relationship management", "partnership management"},
    {"change management", "organizational change", "transformation management",
     "organisational change"},
    {"strategic planning", "strategy", "strategic management", "strategic leadership",
     "organisational strategy", "organizational strategy"},
    {"operations", "operational management", "operations management", "operational planning"},

    # HR & People
    {"recruitment", "talent acquisition", "hiring", "staffing", "talent management",
     "talent sourcing", "headhunting"},
    {"performance management", "performance appraisal", "performance review",
     "performance evaluation", "kpi management"},
    {"training", "learning and development", "l&d", "capacity building",
     "staff development", "employee development", "training and development"},
    {"hr", "human resources", "human resource management", "hrm", "people operations"},
    {"employee relations", "labour relations", "labor relations", "industrial relations",
     "workforce management"},

    # Monitoring, Evaluation & Research
    {"m&e", "monitoring and evaluation", "monitoring & evaluation", "mne",
     "results management", "results based management", "impact measurement"},
    {"research", "data analysis", "analysis", "analytics", "evidence generation",
     "research and analysis"},
    {"data management", "database management", "information management",
     "data administration"},
    {"spss", "statistical analysis", "stata", "quantitative analysis",
     "statistical software", "data science"},
    {"qualitative research", "qualitative analysis", "thematic analysis",
     "focus group", "key informant interview"},

    # Health & Clinical
    {"clinical", "medical", "healthcare", "health care", "patient care"},
    {"rehabilitation", "rehab", "physiotherapy", "physical therapy",
     "occupational therapy", "therapy"},
    {"wash", "water sanitation hygiene", "water and sanitation",
     "water sanitation and hygiene"},
    {"public health", "community health", "population health", "global health"},
    {"disability", "persons with disability", "pwd", "inclusive health",
     "disability inclusion"},

    # NGO / Development sector
    {"ngo", "non-governmental organization", "non-governmental organisation",
     "nonprofit", "non-profit", "civil society", "development organization"},
    {"donor relations", "donor management", "donor reporting",
     "donor engagement", "grant reporting"},
    {"advocacy", "policy advocacy", "campaigning", "policy influencing"},
    {"community engagement", "community development", "community mobilization",
     "community outreach", "grassroots"},
    {"capacity building", "institutional strengthening", "organisational development",
     "organizational development"},

    # Tools & Systems
    {"microsoft office", "ms office", "word excel powerpoint", "office suite"},
    {"erp", "enterprise resource planning", "sap", "oracle financials"},
    {"crm", "customer relationship management", "salesforce"},
    {"gis", "geographic information systems", "geospatial analysis", "arcgis", "qgis"},
    {"power bi", "tableau", "data visualization", "business intelligence", "reporting tools"},

    # Qualifications
    {"phd", "doctorate", "doctoral", "ph.d", "doctor of philosophy"},
    {"mba", "master of business administration", "postgraduate management"},
    {"mbbs", "bachelor of medicine", "medical degree", "md"},
]

# Build lookup: canonical term → its synonym set (excluding itself)
# Every term in a group maps to all others — inherently bidirectional.
_SYNONYM_LOOKUP: dict[str, set[str]] = {}
for _group in _SYNONYM_GROUPS:
    for _term in _group:
        _SYNONYM_LOOKUP[_term] = _group - {_term}

# ---------------------------------------------------------------------------
# Prompt-default category weights — the LLM often copies these verbatim.
# If the output matches this template, we recalibrate from keyword distribution.
# ---------------------------------------------------------------------------
_TEMPLATE_CAT_WEIGHTS: dict[str, float] = {
    "domain": 0.30, "capability": 0.25, "leadership": 0.20,
    "finance": 0.10, "research": 0.10, "l&d": 0.03, "tools": 0.01, "soft": 0.01,
}


def _is_stale_category_weights(category_weights_raw: dict) -> bool:
    """Return True when the LLM's category_weights are identical (or near-identical)
    to the prompt template defaults — a sign the model didn't actually derive them
    from the JD content."""
    if not category_weights_raw:
        return True
    # Normalise both to lowercase for comparison
    norm = {_normalize_cat(k).lower(): round(float(v), 2) for k, v in category_weights_raw.items()}
    template = {k: round(v, 2) for k, v in _TEMPLATE_CAT_WEIGHTS.items()}
    matches = sum(1 for k, v in norm.items() if template.get(k) == v)
    return matches >= 6  # 6+ of 8 values match the template → stale


def _recalibrate_category_weights(cat_total_weight: dict) -> dict:
    """Derive category weights from actual keyword distribution when LLM output is stale.
    Categories with more / heavier keywords get proportionally higher weight."""
    total = sum(cat_total_weight.values()) or 1.0
    return {cat: w / total for cat, w in cat_total_weight.items() if w > 0}


# ---------------------------------------------------------------------------
# Lightweight stemmer — strips common English suffixes so "manages",
# "managing", "management" all reduce to "manag", enabling soft matches.
# ---------------------------------------------------------------------------
_SUFFIXES = [
    "ational", "tional", "ization", "isation", "iveness", "fulness", "ousness",
    "ation", "alism", "ments", "ness", "tions", "sion", "ings", "ment", "tion",
    "ing", "ied", "ier", "ies", "ers", "ors", "ed", "er", "or",
    "ly", "al", "ic", "ful", "ous", "ive", "en", "es", "s",
]


def _stem(token: str) -> str:
    for suffix in _SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            return token[: -len(suffix)]
    return token


# ---------------------------------------------------------------------------
# Experience parsing helpers
# ---------------------------------------------------------------------------

def _parse_jd_experience(exp_str: str) -> tuple[Optional[float], Optional[float]]:
    """Parse a JD experience string into (min_years, max_years).
    Returns (None, None) if unparseable.
    Examples: '5–8 years' → (5, 8), '3+ years' → (3, None), '5 years' → (5, 5)
    """
    s = (exp_str or "").lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*year", s)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r"(\d+(?:\.\d+)?)\s*\+\s*year", s)
    if m:
        return float(m.group(1)), None
    m = re.search(r"(?:minimum|at least|min\.?|over|more than|above)\s+(\d+(?:\.\d+)?)\s*year", s)
    if m:
        return float(m.group(1)), None
    m = re.search(r"(\d+(?:\.\d+)?)\s*year", s)
    if m:
        v = float(m.group(1))
        return v, v
    return None, None


_WORD_TO_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
}


def _extract_cv_experience(profile: str) -> Optional[float]:
    """Extract explicitly stated years of experience from CV text.
    Handles numeric, word-form, and natural-language expressions.
    """
    text = profile.lower()

    # Numeric patterns
    numeric_patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*years?\s+of\s+(?:total\s+|overall\s+|combined\s+|professional\s+)?experience",
        r"(\d+(?:\.\d+)?)\+?\s*years?\s+(?:of\s+)?(?:work|professional|industry|relevant|hands.on)\s+experience",
        r"experience\s+of\s+(?:over\s+|more\s+than\s+)?(\d+(?:\.\d+)?)\+?\s*years?",
        r"(?:over|more than|above|nearly|almost|approximately)\s+(\d+(?:\.\d+)?)\s*years?\s+(?:of\s+)?experience",
        r"(\d+(?:\.\d+)?)\+\s*years?\s+experience",
        r"(\d+(?:\.\d+)?)\s*years?\s+(?:of\s+)?(?:extensive\s+)?(?:experience|expertise)",
    ]
    for pat in numeric_patterns:
        m = re.search(pat, text)
        if m:
            return float(m.group(1))

    # Natural language: "a decade", "over a decade", "two decades"
    m = re.search(r"(\w+)\s+decades?\s+(?:of\s+)?experience", text)
    if m:
        word = m.group(1)
        if word == "a" or word == "one":
            return 10.0
        if word in _WORD_TO_NUM:
            return float(_WORD_TO_NUM[word]) * 10

    m = re.search(r"(?:over\s+|more\s+than\s+|nearly\s+)?a\s+decade\s+(?:of\s+)?(?:experience|expertise)", text)
    if m:
        return 10.0

    # Word-form numbers: "fifteen years of experience"
    words_pat = "|".join(_WORD_TO_NUM.keys())
    m = re.search(rf"({words_pat})\s+years?\s+(?:of\s+)?(?:experience|expertise)", text)
    if m:
        return float(_WORD_TO_NUM[m.group(1)])

    return None


def _experience_adjustment(jd: dict, profile: str) -> tuple[float, str]:
    """Return (score_delta, note) based on experience fit.
    Within range → +5, above range → +2, below → up to -15.
    """
    min_req, max_req = _parse_jd_experience(jd.get("experience_required") or "")
    if min_req is None:
        return 0.0, ""

    cv_exp = _extract_cv_experience(profile)
    if cv_exp is None:
        return 0.0, "Experience not clearly stated in CV."

    cv_label = f"{cv_exp:.0f} yr{'s' if cv_exp != 1 else ''}"
    req_label = f"{min_req:.0f}–{max_req:.0f} yrs" if max_req else f"{min_req:.0f}+ yrs"

    if max_req is None:
        if cv_exp >= min_req:
            return 5.0, f"{cv_label} meets {req_label} requirement."
        gap = min_req - cv_exp
        return max(-15.0, -(gap * 4)), f"{cv_label} is {gap:.0f} yr(s) below the {req_label} requirement."
    else:
        if min_req <= cv_exp <= max_req:
            return 5.0, f"{cv_label} is within the {req_label} requirement."
        if cv_exp < min_req:
            gap = min_req - cv_exp
            return max(-15.0, -(gap * 4)), f"{cv_label} is {gap:.0f} yr(s) below the {req_label} requirement."
        return 2.0, f"{cv_label} exceeds the {req_label} requirement."


# ---------------------------------------------------------------------------
# Negation detection — "no experience in Python" must not match "Python"
# ---------------------------------------------------------------------------

_NEGATION_RE = re.compile(
    r'\b(?:no|not|without|lacking?|never|absence\s+of|non-?)\b'
)


def _is_negated(text: str, match_pos: int, window: int = 70) -> bool:
    """Return True if the keyword match at *match_pos* is preceded by a negation
    in the same sentence/clause (looks back up to *window* characters).
    """
    start = max(0, match_pos - window)
    context = text[start:match_pos]
    # Don't look across sentence or line boundaries
    last_break = max(context.rfind('.'), context.rfind('\n'), context.rfind(';'))
    if last_break != -1:
        context = context[last_break + 1:]
    return bool(_NEGATION_RE.search(context))


# ---------------------------------------------------------------------------
# Education scoring helpers
# ---------------------------------------------------------------------------

# Degree level patterns searched against CV text (highest level found wins)
_CV_DEGREE_RES: list[tuple[int, re.Pattern]] = [
    (5, re.compile(r'\b(?:ph\.?d\.?|doctorate|doctoral)\b')),
    (4, re.compile(r'\b(?:master(?:\'?s)?|m\.?sc\.?|m\.?a\.?\b|mba|mphil|m\.?eng\.?|postgrad(?:uate)?)\b')),
    (3, re.compile(r'\b(?:bachelor(?:\'?s)?|b\.?sc\.?|b\.?a\.?\b|btech|llb|b\.?eng\.?|undergraduate|honours|hons)\b')),
    (2, re.compile(r'\b(?:diploma|associate|hnd|hnc)\b')),
    (1, re.compile(r'\bcertificat(?:e|ion)\b')),
]

_JD_DEGREE_LEVEL: dict[str, int] = {
    "phd": 5, "doctorate": 5, "doctoral": 5, "ph.d": 5,
    "master's": 4, "masters": 4, "master": 4, "msc": 4, "mba": 4, "postgraduate": 4,
    "bachelor's": 3, "bachelors": 3, "bachelor": 3, "bsc": 3, "undergraduate": 3, "degree": 3,
    "diploma": 2, "associate": 2,
    "certificate": 1, "cert": 1,
}

_DEGREE_LABEL: dict[int, str] = {5: "PhD", 4: "Master's", 3: "Bachelor's", 2: "Diploma", 1: "Certificate"}


def _cv_degree_level(profile_lower: str) -> int:
    """Return the highest degree level (1-5) found in the CV; 0 if none detected."""
    for level, pat in _CV_DEGREE_RES:
        if pat.search(profile_lower):
            return level
    return 0


def _jd_degree_level(degree_str: str) -> int:
    return _JD_DEGREE_LEVEL.get(degree_str.lower().strip(), 0)


def _education_adjustment(jd: dict, profile_lower: str) -> tuple[float, str]:
    """Return (score_delta, note) based on education fit.
    Meets preferred  → +5, meets minimum only → +2, below minimum → -8.
    Matching field of study → additional +3.
    """
    edu = jd.get("education_requirements") or {}
    min_deg = edu.get("minimum_degree") or ""
    pref_deg = edu.get("preferred_degree") or ""
    raw_fields = edu.get("fields") or []
    if isinstance(raw_fields, str):
        fields: list[str] = [f.strip() for f in raw_fields.split(",") if f.strip()]
    else:
        fields: list[str] = raw_fields

    min_level = _jd_degree_level(min_deg)
    pref_level = _jd_degree_level(pref_deg)
    cv_level = _cv_degree_level(profile_lower)

    if not min_level:
        return 0.0, ""

    notes: list[str] = []
    delta = 0.0

    if cv_level == 0:
        notes.append("Education level not detected in CV.")
    elif pref_level and cv_level >= pref_level:
        delta += 5.0
        notes.append(f"Meets preferred {_DEGREE_LABEL.get(pref_level, pref_deg)} requirement.")
    elif cv_level >= min_level:
        delta += 2.0
        notes.append(f"Meets minimum {_DEGREE_LABEL.get(min_level, min_deg)} requirement.")
    else:
        delta -= 8.0
        notes.append(
            f"Below required {_DEGREE_LABEL.get(min_level, min_deg)} "
            f"(detected: {_DEGREE_LABEL.get(cv_level, 'lower level')})."
        )

    # Field of study bonus
    if fields and cv_level > 0:
        for field in fields:
            if field.lower() in profile_lower:
                delta += 3.0
                notes.append(f"Relevant field: {field}.")
                break

    return delta, " ".join(notes)


# ---------------------------------------------------------------------------
# Section-aware matching helpers
# ---------------------------------------------------------------------------

_SECTION_HEADER_RE = re.compile(
    r'(?:^|\n)[ \t]*([A-Za-z][A-Za-z &\/\-]{2,50})[ \t]*:?[ \t]*(?:\n|$)',
)


def _get_section_boost(header: str) -> float:
    """Return a scoring multiplier for keywords found in this CV section.
    Returns 0.0 if the header is not a recognised section name (will be skipped).
    """
    h = header.lower().strip()
    if any(s in h for s in ("skill", "competenc", "expertise", "proficienc")):
        return 1.15
    if any(s in h for s in ("experience", "employment", "career history", "work history")):
        return 1.10
    if any(s in h for s in ("education", "qualification", "certif", "license", "training",
                             "credential", "academic")):
        return 1.05
    if any(s in h for s in ("interest", "hobbi", "activit", "reference", "volunteer",
                             "extracurricular", "personal")):
        return 0.90
    return 0.0  # unrecognised — do not change boost


def _parse_cv_sections(profile_lower: str) -> list[tuple[int, float]]:
    """Return sorted list of (char_position, boost) for each recognised section transition."""
    sections: list[tuple[int, float]] = [(0, 1.0)]  # default boost before first header
    for m in _SECTION_HEADER_RE.finditer(profile_lower):
        boost = _get_section_boost(m.group(1))
        if boost:
            sections.append((m.start(), boost))
    return sorted(sections)


def _boost_at(pos: int, sections: list[tuple[int, float]]) -> float:
    """Look up the section boost applicable at character position *pos*."""
    boost = 1.0
    for start, b in sections:
        if start <= pos:
            boost = b
        else:
            break
    return boost


# ---------------------------------------------------------------------------
# Category normalisation — map raw LLM category strings → category_weights keys
# ---------------------------------------------------------------------------

def _normalize_cat(cat: str) -> str:
    c = cat.lower().strip()
    if c.startswith("domain"): return "Domain"
    if c.startswith("capabilit"): return "Capability"
    if c.startswith("leadership"): return "Leadership"
    if c.startswith("finance"): return "Finance"
    if c.startswith("research"): return "Research"
    if "l&d" in c or "learning" in c: return "L&D"
    if c.startswith("tool") or c.startswith("system"): return "Tools"
    if c.startswith("soft"): return "Soft"
    return cat  # unknown — keep as-is


# ---------------------------------------------------------------------------
# Programmatic keyword-based scoring (no LLM required)
# ---------------------------------------------------------------------------

def _recency_multiplier(match_pos: int, profile_len: int) -> float:
    """Matches in recent experience (top of CV) score higher than old ones.
    Top 35% of text → 1.20×, middle 35% → 1.00×, bottom 30% → 0.85×.
    """
    if profile_len == 0 or match_pos < 0:
        return 1.0
    ratio = match_pos / profile_len
    if ratio <= 0.35:
        return 1.20
    if ratio <= 0.70:
        return 1.00
    return 0.85


def _best_exact_position(word_lower: str, profile_lower: str, cv_sections: list, profile_len: int) -> int:
    """Scan ALL occurrences of word in profile and return the position with the
    best combined section_boost × recency_multiplier score. This fixes the
    first-occurrence bias where a skill buried in an old 2012 role wins over
    the same skill listed in a recent Skills section.
    """
    best_pos = -1
    best_value = -1.0
    start = 0
    while True:
        pos = profile_lower.find(word_lower, start)
        if pos == -1:
            break
        value = _boost_at(pos, cv_sections) * _recency_multiplier(pos, profile_len)
        if value > best_value:
            best_value = value
            best_pos = pos
        start = pos + 1
    return best_pos


def _tokens_in_proximity(tokens: list[str], profile_lower: str, window: int = 150) -> int:
    """Return the start position of a token-match where ALL tokens appear within
    `window` characters of each other, or -1 if no such proximity window exists.
    This prevents "Content" on page 1 + "Development" on page 3 from matching
    "Content Development".
    """
    if not tokens:
        return -1
    # Find all positions of the first token, then check remaining tokens nearby
    anchor = tokens[0]
    start = 0
    while True:
        pos = profile_lower.find(anchor, start)
        if pos == -1:
            return -1
        # Search for all other tokens within [pos-window, pos+window]
        lo = max(0, pos - window)
        hi = min(len(profile_lower), pos + len(anchor) + window)
        snippet = profile_lower[lo:hi]
        if all(t in snippet for t in tokens[1:]):
            return pos
        start = pos + 1
    return -1


def _role_alignment_bonus(jd: dict, profile_lower: str) -> float:
    """Bonus (+0 to +8) when recent job title words overlap with JD role words."""
    role = (jd.get("role") or "").lower()
    if not role:
        return 0.0
    role_tokens = {t for t in re.findall(r"\w+", role) if len(t) > 3
                   and t not in {"the", "and", "for", "with", "this", "that"}}
    if not role_tokens:
        return 0.0
    # Look in first 25% of CV — that's where current/recent title appears
    snippet = profile_lower[: max(300, len(profile_lower) // 4)]
    snippet_tokens = set(re.findall(r"\w+", snippet))
    overlap = role_tokens & snippet_tokens
    if not overlap:
        return 0.0
    ratio = len(overlap) / len(role_tokens)
    return round(ratio * 8, 1)  # up to +8


def _score_candidate(jd: dict, profile: str) -> dict:
    """Score a single candidate. Returns a dict with score, summary, and full match details.

    Matching tiers (first hit wins per keyword):
      Tier 1 — exact    : keyword literal in profile              → 1.00 × weight
      Tier 2 — tokens   : all keyword tokens found individually   → 0.85 × weight
      Tier 3 — synonym  : known synonym phrase / tokens found     → 0.90 / 0.75 × weight
      Tier 4 — stem     : all stemmed tokens in stemmed profile   → 0.75 × weight

    Applied multipliers:
      • Frequency weighting  : log2-scaled, capped at 1.30× (exact matches only)
      • Section-aware boost  : Skills=1.15×, Experience=1.10×, Education=1.05×,
                               Interests=0.90×, other=1.00×
      • Recency multiplier   : top-35% of CV → 1.20×, bottom-30% → 0.85×

    Base score computed via category balance using JD's category_weights, normalised
    over active categories only so perfect match = 100.

    Bonuses:  role alignment  → up to +8 pts
              category breadth → up to +7 pts (covers ≥3 of 4+ required categories)
    Penalties: proportional — up to -25 pts if ALL must-haves missing,
                               up to  -5 pts if ALL good-to-haves missing
               (must-have derived from weight ≥ 7 when LLM omits type)
    Experience: within range → +5, above → +2, below → up to -15
    """
    keywords = jd.get("keywords") or []
    if not keywords:
        return {"score": 0, "summary": "No keywords in job model.",
                "matched_keywords": [], "missing_must": [], "missing_good": [], "experience_note": ""}

    profile_lower = profile.lower()
    profile_len = len(profile_lower)
    profile_stemmed_tokens = {_stem(t) for t in re.findall(r"\w+", profile_lower)}

    # Section-aware: build section map once
    cv_sections = _parse_cv_sections(profile_lower)

    # Normalise keyword fields — fill in defaults the LLM often omits
    for kw in keywords:
        if not kw.get("weight"):
            kw["weight"] = 5
        # Derive type from weight when LLM omits it: high-weight → must-have
        if not kw.get("type"):
            kw["type"] = "must-have" if float(kw["weight"]) >= 7 else "good-to-have"

    # Fix 2: stem deduplication — when two keywords share identical stem signatures
    # (e.g. "Manage" and "Management" → both stem to {"manag"}), keep only the one
    # with higher weight to prevent a single word occurrence inflating both scores.
    _seen_stem_sigs: dict[frozenset, int] = {}  # stem_sig → index of kept keyword
    _deduped_keywords = []
    for kw in keywords:
        word = (kw.get("keyword") or "").strip().lower()
        sig = frozenset(_stem(t) for t in re.findall(r"\w+", word))
        if not sig:
            _deduped_keywords.append(kw)
            continue
        if sig in _seen_stem_sigs:
            existing_idx = _seen_stem_sigs[sig]
            existing_kw = _deduped_keywords[existing_idx]
            if float(kw.get("weight") or 5) > float(existing_kw.get("weight") or 5):
                _deduped_keywords[existing_idx] = kw
                _seen_stem_sigs[sig] = existing_idx
        else:
            _seen_stem_sigs[sig] = len(_deduped_keywords)
            _deduped_keywords.append(kw)
    keywords = _deduped_keywords

    # Category balance: accumulate per-category earned and total weights
    cat_total_weight: dict[str, float] = defaultdict(float)
    cat_earned_weight: dict[str, float] = defaultdict(float)
    for kw in keywords:
        cat_total_weight[_normalize_cat(kw.get("category") or "")] += float(kw["weight"])

    matched_keywords: list[dict] = []
    missing_must: list[str] = []
    missing_good: list[str] = []

    for kw in keywords:
        word = (kw.get("keyword") or "").strip()
        weight = float(kw.get("weight") or 5)
        kw_type = kw.get("type", "good-to-have")
        cat = _normalize_cat(kw.get("category") or "")
        if not word:
            continue

        word_lower = word.lower()
        match_score = 0.0
        tier = ""
        match_pos = -1  # character position of match in profile (for section lookup)

        # Tier 1: exact phrase — pick BEST occurrence (highest section×recency), not first
        if profile_lower.find(word_lower) != -1:
            best_pos = _best_exact_position(word_lower, profile_lower, cv_sections, profile_len)
            match_score, tier, match_pos = 1.0, "exact", best_pos

        # Tier 2: all keyword tokens within proximity window (fixes false token matches)
        if not match_score:
            tokens = word_lower.split()
            if len(tokens) > 1:
                prox_pos = _tokens_in_proximity(tokens, profile_lower, window=150)
                if prox_pos != -1:
                    match_score, tier, match_pos = 0.85, "tokens", prox_pos

        # Tier 3: synonym match
        if not match_score:
            for syn in _SYNONYM_LOOKUP.get(word_lower, set()):
                p = profile_lower.find(syn)
                if p != -1:
                    match_score, tier, match_pos = 0.90, "synonym", p
                    break
                syn_tokens = syn.split()
                if len(syn_tokens) > 1:
                    prox_pos = _tokens_in_proximity(syn_tokens, profile_lower, window=150)
                    if prox_pos != -1:
                        match_score, tier, match_pos = 0.75, "synonym", prox_pos
                        break

        # Tier 4: stemmed keyword tokens present in stemmed profile
        if not match_score:
            kw_stemmed = [_stem(t) for t in re.findall(r"\w+", word_lower)]
            if kw_stemmed and all(s in profile_stemmed_tokens for s in kw_stemmed):
                match_score, tier, match_pos = 0.75, "stem", -1  # position unknown for stems

        if match_score:
            # Negation check — "no experience in X" must not credit X
            if match_pos >= 0 and _is_negated(profile_lower, match_pos):
                if kw_type == "must-have":
                    missing_must.append(word)
                else:
                    missing_good.append(word)
                continue

            # Frequency weighting: reward repeated mentions (exact matches only)
            if tier == "exact":
                count = profile_lower.count(word_lower)
                freq_mult = min(1.3, 1.0 + 0.1 * math.log2(max(count, 1)))
            else:
                freq_mult = 1.0

            # Section-aware boost
            section_boost = _boost_at(match_pos, cv_sections) if match_pos >= 0 else 1.0

            # Recency multiplier — recent experience counts more
            recency_mult = _recency_multiplier(match_pos, profile_len)

            effective = weight * match_score * freq_mult * section_boost * recency_mult
            cat_earned_weight[cat] += effective
            matched_keywords.append({"keyword": word, "tier": tier, "type": kw_type})
        elif kw_type == "must-have":
            missing_must.append(word)
        else:
            missing_good.append(word)

    # Experience and education adjustments
    exp_delta, exp_note = _experience_adjustment(jd, profile)
    edu_delta, edu_note = _education_adjustment(jd, profile_lower)

    # Category balance scoring — weight each category by JD's category_weights
    category_weights_raw = jd.get("category_weights") or {}

    # Fix 7: recalibrate stale weights — LLM often copies template defaults verbatim
    if _is_stale_category_weights(category_weights_raw):
        active_cat_weights = _recalibrate_category_weights(cat_total_weight)
    elif category_weights_raw and cat_total_weight:
        active_cat_weights = {}
        for cat in cat_total_weight:
            cw = category_weights_raw.get(cat, 0)
            if not cw:
                for k, v in category_weights_raw.items():
                    if _normalize_cat(k) == cat:
                        cw = v
                        break
            active_cat_weights[cat] = cw or 0.01
    else:
        active_cat_weights = _recalibrate_category_weights(cat_total_weight)

    # Normalize ONLY over active categories — perfect match = 100
    total_cw = sum(active_cat_weights.values()) or 1.0
    base_score = 0.0
    for cat, total_w in cat_total_weight.items():
        if not total_w:
            continue
        cat_score = cat_earned_weight[cat] / total_w  # 0.0–1.0+
        base_score += cat_score * (active_cat_weights.get(cat, 0.01) / total_cw) * 100

    # Fix 8: breadth bonus weighted by category importance, not raw count (up to +7)
    n_active_cats = len(cat_total_weight)
    if n_active_cats >= 3:
        covered_weight = sum(active_cat_weights.get(c, 0) for c, w in cat_earned_weight.items() if w > 0)
        weighted_breadth = covered_weight / total_cw
        breadth_bonus = round(weighted_breadth * 7, 1) if weighted_breadth > 0 else 0.0
    else:
        breadth_bonus = 0.0

    # Role alignment bonus — recent title words matching JD role (up to +8)
    role_bonus = _role_alignment_bonus(jd, profile_lower)

    # Weight-proportional penalty — heavier keywords penalise more when missing
    # Must-haves: total pool = 25 pts, distributed by relative weight
    # Good-to-haves: total pool = 5 pts, distributed by relative weight
    must_kws = [kw for kw in keywords if kw.get("type") == "must-have"]
    good_kws = [kw for kw in keywords if kw.get("type") != "must-have"]
    total_must_weight = sum(float(kw.get("weight") or 5) for kw in must_kws) or 1.0
    total_good_weight = sum(float(kw.get("weight") or 5) for kw in good_kws) or 1.0

    must_penalty = sum(
        (float(kw.get("weight") or 5) / total_must_weight) * 25
        for kw in must_kws if (kw.get("keyword") or "").strip() in missing_must
    ) if must_kws else 0.0

    good_penalty = sum(
        (float(kw.get("weight") or 5) / total_good_weight) * 5
        for kw in good_kws if (kw.get("keyword") or "").strip() in missing_good
    ) if good_kws else 0.0

    penalty = must_penalty + good_penalty

    raw_score = round(base_score - penalty + exp_delta + edu_delta + breadth_bonus + role_bonus, 2)
    # Fix 9: keep raw (uncapped) score for ranking; cap only for display
    final_score = max(0, min(100, round(raw_score)))

    # Match confidence — based on how reliable the tier distribution is
    total_m = len(matched_keywords)
    if total_m == 0:
        confidence = "none"
    else:
        exact_ratio = sum(1 for m in matched_keywords if m["tier"] == "exact") / total_m
        strong_ratio = sum(1 for m in matched_keywords if m["tier"] in ("exact", "tokens")) / total_m
        if exact_ratio >= 0.65:
            confidence = "high"
        elif strong_ratio >= 0.50:
            confidence = "medium"
        else:
            confidence = "low"

    # CV parse quality warning
    word_count = len(profile.split())
    parse_warning = (
        "CV text appears very short — file may not have extracted correctly. Score may be unreliable."
        if word_count < 150 else ""
    )

    # One-liner summary
    matched_names = [m["keyword"] for m in matched_keywords]
    parts: list[str] = []
    if matched_names:
        top = matched_names[:3]
        extra = len(matched_names) - len(top)
        parts.append("Matched: " + ", ".join(top) + (f" +{extra} more" if extra else ""))
    if missing_must:
        top_m = missing_must[:2]
        extra_m = len(missing_must) - len(top_m)
        parts.append("missing must-haves: " + ", ".join(top_m) + (f" +{extra_m} more" if extra_m else ""))
    elif missing_good and not matched_names:
        parts.append("No keyword matches found")
    if exp_note:
        parts.append(exp_note)

    summary = ("; ".join(parts) + ".") if parts else "No keyword matches found."

    return {
        "score": final_score,
        "raw_score": raw_score,   # uncapped — used for ranking before display normalisation
        "summary": summary,
        "matched_keywords": matched_keywords,
        "missing_must": missing_must,
        "missing_good": missing_good,
        "experience_note": exp_note,
        "education_note": edu_note,
        "confidence": confidence,
        "parse_warning": parse_warning,
    }


def _rank_programmatic(jd_json: str, cv_pairs: list[tuple[str, str]]) -> list[dict]:
    """Score and rank all candidates instantly without any LLM call."""
    try:
        jd = json.loads(jd_json)
    except json.JSONDecodeError:
        jd = {}

    results: list[dict] = []
    for label, profile in cv_pairs:
        result = _score_candidate(jd, profile)
        results.append({
            "candidate_name": label,
            "score": result["score"],
            "_raw": result["raw_score"],   # temp field for ranking; removed before return
            "summary": result["summary"],
            "match_details": {
                "matched_keywords": result["matched_keywords"],
                "missing_must": result["missing_must"],
                "missing_good": result["missing_good"],
                "experience_note": result["experience_note"],
                "education_note": result["education_note"],
                "confidence": result["confidence"],
                "parse_warning": result["parse_warning"],
            },
        })

    # Fix 9: sort by uncapped raw score so ties break correctly (e.g. 105 vs 102 both cap to 100)
    results.sort(key=lambda r: r["_raw"], reverse=True)

    # Fix 3: relative normalisation — wider trigger: low absolute top OR narrow spread
    TARGET_TOP = 88
    raw_vals = [r["_raw"] for r in results]
    if raw_vals:
        top_raw = max(raw_vals)
        bottom_raw = min(raw_vals)
        spread = top_raw - bottom_raw
        if 1 <= top_raw < 70 or (top_raw < 85 and spread < 30):
            scale = TARGET_TOP / top_raw
            for r in results:
                r["score"] = min(100, round(max(0, r["_raw"]) * scale))

    for r in results:
        r.pop("_raw", None)
    for i, row in enumerate(results):
        row["rank"] = i + 1

    return results


def _normalize_ranking_payload(ranking: object) -> list[dict]:
    if isinstance(ranking, list):
        return ranking
    if isinstance(ranking, dict):
        for key in ("ranking", "candidates", "results", "rankings", "rank"):
            value = ranking.get(key)
            if isinstance(value, list):
                return value
    return []



def _write_llm_log(db: Optional[Session], *, model: str, operation: str,
                   prompt_chars: int, resp_chars: int, latency_ms: float,
                   success: bool, error: str = "") -> None:
    if db is None:
        return
    try:
        db.add(LLMLog(model=model, operation=operation, prompt_chars=prompt_chars,
                      resp_chars=resp_chars, latency_ms=latency_ms,
                      success=success, error=error))
        db.commit()
    except Exception as exc:
        log.warning("llm_log write failed: %s", exc)


async def _run_jd_analysis(jd_text: str, jd_title: Optional[str],
                           db: Optional[Session] = None) -> dict:
    started = perf_counter()
    if not jd_text or not jd_text.strip():
        raise HTTPException(400, "No JD text provided.")
    prompt = JD_ANALYSIS_PROMPT.replace("{JD_TEXT}", jd_text)
    model = get_jd_model()
    try:
        jd_json = await call_llm_json(prompt, max_output_tokens=1500, retries=0, model=model)
    except LLMError as e:
        latency = (perf_counter() - started) * 1000
        _write_llm_log(db, model=model, operation="jd_analysis",
                       prompt_chars=len(prompt), resp_chars=0,
                       latency_ms=latency, success=False, error=str(e))
        raise HTTPException(502, str(e))

    # Programmatic augmentation — add domain-dict keywords the LLM missed
    llm_keywords: list[dict] = jd_json.get("keywords") or []
    extra = augment_keywords(jd_text, llm_keywords)
    if extra:
        jd_json["keywords"] = llm_keywords + extra
        log.info("analyze_jd augmented llm=%s extra=%s total=%s",
                 len(llm_keywords), len(extra), len(jd_json["keywords"]))

    elapsed = (perf_counter() - started) * 1000
    resp_text = json.dumps(jd_json)
    _write_llm_log(db, model=model, operation="jd_analysis",
                   prompt_chars=len(prompt), resp_chars=len(resp_text),
                   latency_ms=elapsed, success=True)

    result = {
        "title": jd_title or jd_json.get("role") or "Untitled Role",
        "raw_text": jd_text,
        "jd_json": jd_json,
    }
    log.info("analyze_jd chars=%s elapsed_ms=%.1f", len(jd_text), elapsed)
    return result


@router.post("/analyze")
async def analyze_jd_json(body: AnalyzeJDRequest, db: Session = Depends(get_db)):
    return await _run_jd_analysis(body.text, body.title, db)


@router.post("/analyze-file")
async def analyze_jd_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    data = await file.read()
    try:
        jd_text = extract_text(file.filename, data)
    except ParseError as e:
        raise HTTPException(400, str(e))
    return await _run_jd_analysis(jd_text, title, db)


@router.post("")
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    job = Job(
        title=payload.title,
        raw_text=payload.raw_text,
        jd_json=json.dumps(payload.jd_json),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _serialize_job(job, db)


@router.put("/{job_id}")
def update_job(job_id: int, payload: JobCreate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    job.title = payload.title
    job.raw_text = payload.raw_text
    job.jd_json = json.dumps(payload.jd_json)
    db.commit()
    db.refresh(job)
    return _serialize_job(job, db)


@router.get("")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "created_at": j.created_at.isoformat(),
            "cv_count": len(j.cvs),
        }
        for j in jobs
    ]


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    return _serialize_job(job, db)


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    db.delete(job)
    db.commit()
    return {"ok": True}


@router.post("/{job_id}/cvs")
async def upload_cvs(
    job_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    started = perf_counter()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    if not files:
        raise HTTPException(400, "No files uploaded.")
    if len(files) > MAX_CV_UPLOAD:
        raise HTTPException(400, f"Upload at most {MAX_CV_UPLOAD} CVs at a time.")

    created = []
    skipped = 0
    for upload in files:
        data = await upload.read()
        try:
            text = extract_text(upload.filename, data)
        except ParseError as e:
            raise HTTPException(400, f"{upload.filename}: {e}")
        profile = build_candidate_profile(text)
        existing = (
            db.query(CV)
            .filter(CV.job_id == job_id, CV.filename == upload.filename, CV.raw_text == text)
            .first()
        )
        if existing:
            if not existing.candidate_profile:
                existing.candidate_profile = profile
            skipped += 1
            continue
        name = guess_candidate_name(text, upload.filename)
        cv = CV(
            job_id=job_id,
            candidate_name=name,
            filename=upload.filename,
            raw_text=text,
            candidate_profile=profile,
        )
        db.add(cv)
        created.append(cv)
    db.commit()
    for cv in created:
        db.refresh(cv)

    result = [
        {
            "id": cv.id,
            "candidate_name": cv.candidate_name,
            "filename": cv.filename,
            "created_at": cv.created_at.isoformat(),
        }
        for cv in created
    ]
    log.info(
        "upload_cvs job_id=%s files=%s created=%s skipped=%s elapsed_ms=%.1f",
        job_id,
        len(files),
        len(created),
        skipped,
        (perf_counter() - started) * 1000,
    )
    return result


@router.post("/{job_id}/rank")
async def rank_candidates(job_id: int, db: Session = Depends(get_db)):
    started = perf_counter()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    if not job.cvs:
        raise HTTPException(400, "No CVs uploaded for this job yet.")

    # Use full JD JSON — all keywords, no truncation needed (no LLM context limit)
    jd_json = job.jd_json

    cv_pairs: list[tuple[str, str]] = []
    for idx, cv in enumerate(job.cvs, start=1):
        label = cv.candidate_name or cv.filename or f"Candidate {idx}"
        if not cv.candidate_profile:
            cv.candidate_profile = build_candidate_profile(cv.raw_text)
        # Use full profile for keyword matching — no context window constraint
        cv_pairs.append((label, cv.candidate_profile))
    db.commit()

    log.info("rank_candidates job_id=%s cvs=%s using=programmatic", job_id, len(cv_pairs))
    all_results = _rank_programmatic(jd_json, cv_pairs)

    ranking_row = BulkRanking(job_id=job_id, ranking_json=json.dumps(all_results))
    db.add(ranking_row)
    db.commit()
    log.info(
        "rank_candidates job_id=%s cvs=%s elapsed_ms=%.1f",
        job_id,
        len(job.cvs),
        (perf_counter() - started) * 1000,
    )
    return all_results


@router.get("/{job_id}/decisions")
def get_decisions(job_id: int, db: Session = Depends(get_db)):
    rows = db.query(CandidateDecision).filter(CandidateDecision.job_id == job_id).all()
    return {r.candidate_name: {"decision": r.decision, "note": r.note} for r in rows}


@router.put("/{job_id}/decisions/{candidate_name}")
def set_decision(job_id: int, candidate_name: str, body: dict, db: Session = Depends(get_db)):
    decision = body.get("decision", "pending")
    note = body.get("note", "")
    row = (db.query(CandidateDecision)
           .filter(CandidateDecision.job_id == job_id,
                   CandidateDecision.candidate_name == candidate_name)
           .first())
    if row:
        row.decision = decision
        row.note = note
    else:
        row = CandidateDecision(job_id=job_id, candidate_name=candidate_name,
                                decision=decision, note=note)
        db.add(row)
    db.commit()
    return {"ok": True}


def _serialize_job(job: Job, db: Session) -> dict:
    latest = (
        db.query(BulkRanking)
        .filter(BulkRanking.job_id == job.id)
        .order_by(BulkRanking.created_at.desc())
        .first()
    )
    return {
        "id": job.id,
        "title": job.title,
        "raw_text": job.raw_text,
        "jd_json": json.loads(job.jd_json),
        "created_at": job.created_at.isoformat(),
        "cvs": [
            {
                "id": cv.id,
                "candidate_name": cv.candidate_name,
                "filename": cv.filename,
                "created_at": cv.created_at.isoformat(),
            }
            for cv in job.cvs
        ],
        "latest_ranking": _normalize_ranking_payload(json.loads(latest.ranking_json)) if latest else None,
    }
