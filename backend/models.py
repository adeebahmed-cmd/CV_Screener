from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db import Base


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=False)
    jd_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="cvs")
    evaluations = relationship("DetailedEvaluation", back_populates="cv", cascade="all, delete-orphan")


class BulkRanking(Base):
    __tablename__ = "bulk_rankings"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    ranking_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="rankings")


class DetailedEvaluation(Base):
    __tablename__ = "detailed_evaluations"
    id = Column(Integer, primary_key=True, index=True)
    cv_id = Column(Integer, ForeignKey("cvs.id"), nullable=False)
    evaluation_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    cv = relationship("CV", back_populates="evaluations")


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
