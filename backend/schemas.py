from typing import Any, Optional, List
from datetime import datetime
from pydantic import BaseModel


class AnalyzeJDRequest(BaseModel):
    title: Optional[str] = None
    text: str


class JobCreate(BaseModel):
    title: str
    raw_text: str
    jd_json: Any


class JobSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    cv_count: int = 0

    class Config:
        from_attributes = True


class CVSummary(BaseModel):
    id: int
    candidate_name: Optional[str]
    filename: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class JobDetail(BaseModel):
    id: int
    title: str
    raw_text: str
    jd_json: Any
    created_at: datetime
    cvs: List[CVSummary] = []
    latest_ranking: Optional[Any] = None


class SettingsPayload(BaseModel):
    model: Optional[str] = None


class HealthResponse(BaseModel):
    ok: bool
    models_available: List[str] = []
    error: Optional[str] = None
