import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import SessionLocal, init_db
from models import CV, Job
from routes import cvs as cvs_routes
from routes import jobs as jobs_routes
from routes import settings as settings_routes

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="APD CV Ranker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"ok": True, "service": "apd-cv-ranker"}


@app.get("/api/stats")
def stats():
    db = SessionLocal()
    try:
        return {
            "jobs": db.query(Job).count(),
            "cvs": db.query(CV).count(),
        }
    finally:
        db.close()


app.include_router(jobs_routes.router)
app.include_router(cvs_routes.router)
app.include_router(settings_routes.router)
