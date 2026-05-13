"""
Analytics endpoint — aggregated stats for the dashboard.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import get_db
from models import BulkRanking, CV, Job, LLMLog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def get_analytics(db: Session = Depends(get_db)):
    # --- Basic counts ---
    total_jobs = db.query(Job).count()
    total_cvs  = db.query(CV).count()

    # --- Collect scores from the latest ranking of every job ---
    all_scores: list[float] = []
    top_missing: dict[str, int] = {}

    # Get the latest BulkRanking per job
    subq = (
        db.query(
            BulkRanking.job_id,
            func.max(BulkRanking.created_at).label("latest")
        )
        .group_by(BulkRanking.job_id)
        .subquery()
    )
    latest_rankings = (
        db.query(BulkRanking)
        .join(subq, (BulkRanking.job_id == subq.c.job_id) &
              (BulkRanking.created_at == subq.c.latest))
        .all()
    )

    for ranking in latest_rankings:
        try:
            rows = json.loads(ranking.ranking_json)
        except Exception:
            continue
        for row in rows:
            score = row.get("score")
            if isinstance(score, (int, float)):
                all_scores.append(float(score))
            # Aggregate missing must-haves
            details = row.get("match_details") or {}
            for kw in details.get("missing_must") or []:
                top_missing[kw] = top_missing.get(kw, 0) + 1

    total_ranked = len(all_scores)
    avg_score    = round(sum(all_scores) / total_ranked, 1) if all_scores else 0

    # Score distribution buckets
    dist = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for s in all_scores:
        if   s <= 25:  dist["0-25"]   += 1
        elif s <= 50:  dist["26-50"]  += 1
        elif s <= 75:  dist["51-75"]  += 1
        else:          dist["76-100"] += 1

    # Top 10 missing must-have keywords
    top_missing_list = sorted(top_missing.items(), key=lambda x: -x[1])[:10]

    # --- LLM stats ---
    total_llm = db.query(LLMLog).count()
    failed_llm = db.query(LLMLog).filter(LLMLog.success == False).count()  # noqa
    avg_latency_row = db.query(func.avg(LLMLog.latency_ms)).filter(LLMLog.success == True).scalar()  # noqa
    avg_latency = round(avg_latency_row or 0)

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_llm = db.query(LLMLog).filter(LLMLog.created_at >= cutoff).count()

    return {
        "totals": {
            "jobs":   total_jobs,
            "cvs":    total_cvs,
            "ranked": total_ranked,
        },
        "avg_score": avg_score,
        "score_distribution": [
            {"range": k, "count": v} for k, v in dist.items()
        ],
        "top_missing_keywords": [
            {"keyword": k, "count": v} for k, v in top_missing_list
        ],
        "llm": {
            "total_calls":   total_llm,
            "failed_calls":  failed_llm,
            "avg_latency_ms": avg_latency,
            "last_7d_calls": recent_llm,
        },
    }


@router.get("/llm-logs")
def get_llm_logs(limit: int = 30, db: Session = Depends(get_db)):
    rows = (
        db.query(LLMLog)
        .order_by(LLMLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":           r.id,
            "model":        r.model,
            "operation":    r.operation,
            "prompt_chars": r.prompt_chars,
            "resp_chars":   r.resp_chars,
            "latency_ms":   round(r.latency_ms),
            "success":      r.success,
            "error":        r.error,
            "created_at":   r.created_at.isoformat(),
        }
        for r in rows
    ]
