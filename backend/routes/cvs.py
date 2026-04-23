import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from llm import OllamaError, call_ollama
from models import CV, DetailedEvaluation, Job
from prompts import DEEP_EVAL_PROMPT

router = APIRouter(prefix="/api/cvs", tags=["cvs"])


@router.get("/{cv_id}")
def get_cv(cv_id: int, db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(404, "CV not found.")
    latest = (
        db.query(DetailedEvaluation)
        .filter(DetailedEvaluation.cv_id == cv_id)
        .order_by(DetailedEvaluation.created_at.desc())
        .first()
    )
    return {
        "id": cv.id,
        "job_id": cv.job_id,
        "candidate_name": cv.candidate_name,
        "filename": cv.filename,
        "raw_text": cv.raw_text,
        "created_at": cv.created_at.isoformat(),
        "latest_evaluation": json.loads(latest.evaluation_json) if latest else None,
    }


@router.post("/{cv_id}/evaluate")
async def evaluate_cv(cv_id: int, db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(404, "CV not found.")
    job = db.query(Job).filter(Job.id == cv.job_id).first()
    if not job:
        raise HTTPException(404, "Parent job not found.")

    prompt = (
        DEEP_EVAL_PROMPT
        .replace("{JD_JSON_OUTPUT_FROM_PROMPT_1}", job.jd_json)
        .replace("{CV_TEXT}", cv.raw_text)
    )

    try:
        evaluation = await call_ollama(prompt)
    except OllamaError as e:
        raise HTTPException(502, str(e))

    if isinstance(evaluation, dict) and not evaluation.get("candidate_name"):
        evaluation["candidate_name"] = cv.candidate_name or cv.filename or "Candidate"

    row = DetailedEvaluation(cv_id=cv.id, evaluation_json=json.dumps(evaluation))
    db.add(row)
    db.commit()
    return evaluation
