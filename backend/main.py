import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db import get_db, init_db
from models import CV, Job
from routes import cvs as cvs_routes
from routes import jobs as jobs_routes
from routes import settings as settings_routes

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="APD CV Ranker", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "apd-cv-ranker"}


@app.get("/api/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "jobs": db.query(Job).count(),
        "cvs": db.query(CV).count(),
    }


app.include_router(jobs_routes.router)
app.include_router(cvs_routes.router)
app.include_router(settings_routes.router)
