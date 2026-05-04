import json
import logging
from time import perf_counter
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db import get_db
from llm import LLMError, call_llm_json
from models import BulkRanking, CV, DetailedEvaluation, Job
from parsers import ParseError, build_candidate_profile, extract_text, guess_candidate_name
from prompts import BULK_RANKING_PROMPT, JD_ANALYSIS_PROMPT
from schemas import AnalyzeJDRequest, JobCreate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
log = logging.getLogger(__name__)


def _compact_jd_json(jd_json_text: str) -> str:
    try:
        jd = json.loads(jd_json_text)
    except json.JSONDecodeError:
        return jd_json_text

    keywords = jd.get("keywords") or []
    keywords = sorted(keywords, key=lambda item: item.get("weight", 0), reverse=True)[:25]
    compact = {
        "role": jd.get("role"),
        "experience_required": jd.get("experience_required"),
        "keywords": keywords,
        "category_weights": jd.get("category_weights") or {},
    }
    return json.dumps(compact, separators=(",", ":"))


async def _run_jd_analysis(jd_text: str, jd_title: Optional[str]) -> dict:
    started = perf_counter()
    if not jd_text or not jd_text.strip():
        raise HTTPException(400, "No JD text provided.")
    prompt = JD_ANALYSIS_PROMPT.replace("{JD_TEXT}", jd_text)
    try:
        jd_json = await call_llm_json(prompt, max_output_tokens=4096, retries=1)
    except LLMError as e:
        raise HTTPException(502, str(e))
    result = {
        "title": jd_title or jd_json.get("role") or "Untitled Role",
        "raw_text": jd_text,
        "jd_json": jd_json,
    }
    log.info(
        "analyze_jd chars=%s elapsed_ms=%.1f",
        len(jd_text),
        (perf_counter() - started) * 1000,
    )
    return result


@router.post("/analyze")
async def analyze_jd_json(body: AnalyzeJDRequest):
    """Analyze a JD supplied as raw text (JSON body)."""
    return await _run_jd_analysis(body.text, body.title)


@router.post("/analyze-file")
async def analyze_jd_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
):
    """Analyze a JD supplied as an uploaded PDF/DOCX/TXT file."""
    data = await file.read()
    try:
        jd_text = extract_text(file.filename, data)
    except ParseError as e:
        raise HTTPException(400, str(e))
    return await _run_jd_analysis(jd_text, title)


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
    if len(files) > 10:
        raise HTTPException(400, "Upload at most 10 CVs at a time.")

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

    jd_json = _compact_jd_json(job.jd_json)
    candidates_block_lines = []
    for idx, cv in enumerate(job.cvs, start=1):
        label = cv.candidate_name or cv.filename or f"Candidate {idx}"
        profile = cv.candidate_profile or build_candidate_profile(cv.raw_text)
        if not cv.candidate_profile:
            cv.candidate_profile = profile
        candidates_block_lines.append(f"{idx}. {label}\n{profile}")
    candidates_block = "\n\n-----\n\n".join(candidates_block_lines)

    prompt = (
        BULK_RANKING_PROMPT
        .replace("{JD_JSON}", jd_json)
        .replace("{CANDIDATES_BLOCK}", candidates_block)
    )

    try:
        ranking = await call_llm_json(prompt, max_output_tokens=1024, retries=1)
    except LLMError as e:
        raise HTTPException(502, str(e))

    # The model may return a dict wrapping the list; normalize.
    if isinstance(ranking, dict):
        for key in ("ranking", "candidates", "results", "rankings"):
            if key in ranking and isinstance(ranking[key], list):
                ranking = ranking[key]
                break

    row = BulkRanking(job_id=job_id, ranking_json=json.dumps(ranking))
    db.add(row)
    db.commit()
    log.info(
        "rank_candidates job_id=%s cvs=%s prompt_chars=%s elapsed_ms=%.1f",
        job_id,
        len(job.cvs),
        len(prompt),
        (perf_counter() - started) * 1000,
    )
    return ranking


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
        "latest_ranking": json.loads(latest.ranking_json) if latest else None,
    }
