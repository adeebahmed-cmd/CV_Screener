from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Float, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    picture = Column(String(512))          # Google profile picture URL
    role = Column(String(32), default="recruiter")  # "admin" | "recruiter"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    keywords = relationship("KeywordEntry", back_populates="created_by", foreign_keys="KeywordEntry.created_by_id")


class KeywordEntry(Base):
    """Central keyword repository — shared across all jobs."""
    __tablename__ = "keyword_repository"
    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(255), nullable=False)
    category = Column(String(128), nullable=False)
    weight = Column(Float, default=5.0)
    kw_type = Column(String(32), default="good-to-have")   # must-have | good-to-have
    synonyms = Column(JSON, default=list)                  # list[str]
    status = Column(String(32), default="pending")         # pending | approved
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    created_by = relationship("User", back_populates="keywords", foreign_keys=[created_by_id])


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=False)
    jd_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    cvs = relationship("CV", back_populates="job", cascade="all, delete-orphan")
    rankings = relationship("BulkRanking", back_populates="job", cascade="all, delete-orphan")


class CV(Base):
    __tablename__ = "cvs"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_name = Column(String(255))
    filename = Column(String(255))
    raw_text = Column(Text, nullable=False)
    candidate_profile = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="cvs")
    evaluations = relationship("DetailedEvaluation", back_populates="cv", cascade="all, delete-orphan")


class BulkRanking(Base):
    __tablename__ = "bulk_rankings"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    ranking_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="rankings")


class DetailedEvaluation(Base):
    __tablename__ = "detailed_evaluations"
    id = Column(Integer, primary_key=True, index=True)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=False)
    evaluation_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    cv = relationship("CV", back_populates="evaluations")


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)


class LLMLog(Base):
    """One row per LLM call — tracks latency, token usage, and errors."""
    __tablename__ = "llm_logs"
    id           = Column(Integer, primary_key=True, index=True)
    model        = Column(String(128))
    operation    = Column(String(64))   # "jd_analysis" | "deep_eval"
    prompt_chars = Column(Integer, default=0)
    resp_chars   = Column(Integer, default=0)
    latency_ms   = Column(Float,   default=0.0)
    success      = Column(Boolean, default=True)
    error        = Column(Text,    default="")
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CandidateDecision(Base):
    """Recruiter decision for each ranked candidate per job."""
    __tablename__ = "candidate_decisions"
    id             = Column(Integer, primary_key=True, index=True)
    job_id         = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_name = Column(String(255), nullable=False)
    decision       = Column(String(32), default="pending")  # pending|shortlisted|hold|rejected
    note           = Column(Text, default="")
    updated_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    job = relationship("Job")
