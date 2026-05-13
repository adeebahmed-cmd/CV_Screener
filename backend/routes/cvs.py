import json
import logging
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from llm import LLMError, call_llm_json
from models import CV, DetailedEvaluation, Job, LLMLog
from parsers import build_candidate_profile
from prompts import DEEP_EVAL_PROMPT

router = APIRouter(prefix="/api/cvs", tags=["cvs"])
log = logging.getLogger(__name__)


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
    started = perf_counter()
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(404, "CV not found.")
    job = db.query(Job).filter(Job.id == cv.job_id).first()
    if not job:
        raise HTTPException(404, "Parent job not found.")

    profile = cv.candidate_profile or build_candidate_profile(cv.raw_text)
    prompt = (
        DEEP_EVAL_PROMPT
        .replace("{JD_JSON_OUTPUT_FROM_PROMPT_1}", job.jd_json)
        .replace("{CV_TEXT}", profile)
    )

    from llm import get_ollama_model
    model_name = get_ollama_model()
    try:
        evaluation = await call_llm_json(prompt, max_output_tokens=3072, retries=1)
    except LLMError as e:
        latency = (perf_counter() - started) * 1000
        db.add(LLMLog(model=model_name, operation="deep_eval", prompt_chars=len(prompt),
                      resp_chars=0, latency_ms=latency, success=False, error=str(e)))
        db.commit()
        raise HTTPException(502, str(e))

    latency = (perf_counter() - started) * 1000
    resp_text = json.dumps(evaluation)
    db.add(LLMLog(model=model_name, operation="deep_eval", prompt_chars=len(prompt),
                  resp_chars=len(resp_text), latency_ms=latency, success=True))

    if isinstance(evaluation, dict) and not evaluation.get("candidate_name"):
        evaluation["candidate_name"] = cv.candidate_name or cv.filename or "Candidate"

    row = DetailedEvaluation(cv_id=cv.id, evaluation_json=json.dumps(evaluation))
    db.add(row)
    db.commit()
    log.info("evaluate_cv cv_id=%s elapsed_ms=%.1f", cv_id, latency)
    return evaluation


@router.delete("/{cv_id}")
def delete_cv(cv_id: int, db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(404, "CV not found.")
    db.query(DetailedEvaluation).filter(DetailedEvaluation.cv_id == cv_id).delete()
    db.delete(cv)
    db.commit()
    return {"ok": True}


@router.delete("/job/{job_id}/all")
def delete_all_cvs(job_id: int, db: Session = Depends(get_db)):
    from models import BulkRanking, CandidateDecision
    cv_ids = [r[0] for r in db.query(CV.id).filter(CV.job_id == job_id).all()]
    if not cv_ids:
        return {"deleted": 0}
    db.query(DetailedEvaluation).filter(DetailedEvaluation.cv_id.in_(cv_ids)).delete(synchronize_session=False)
    db.query(CandidateDecision).filter(CandidateDecision.job_id == job_id).delete(synchronize_session=False)
    db.query(BulkRanking).filter(BulkRanking.job_id == job_id).delete(synchronize_session=False)
    db.query(CV).filter(CV.job_id == job_id).delete(synchronize_session=False)
    db.commit()
    return {"deleted": len(cv_ids)}
