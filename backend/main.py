import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from db import get_db, init_db
from llm import get_jd_model, warmup_model
from models import CV, Job
from routes import cvs as cvs_routes
from routes import jobs as jobs_routes
from routes import settings as settings_routes
from routes import auth as auth_routes
from routes import repository as repository_routes
from routes import users as users_routes
from routes import analytics as analytics_routes

logging.basicConfig(level=logging.INFO)

# Path to the built React frontend (populated by `npm run build`)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(warmup_model(get_jd_model()))
    yield


app = FastAPI(title="APD CV Ranker", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:8000", "http://127.0.0.1:8000"],
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


app.include_router(auth_routes.router)
app.include_router(jobs_routes.router)
app.include_router(cvs_routes.router)
app.include_router(settings_routes.router)
app.include_router(repository_routes.router)
app.include_router(users_routes.router)
app.include_router(analytics_routes.router)

# Serve built React frontend — must come AFTER all API routes
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA client-side routing)."""
        file = FRONTEND_DIST / full_path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
