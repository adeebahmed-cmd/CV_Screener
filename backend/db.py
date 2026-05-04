from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_schema()


def _ensure_schema():
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(cvs)")).fetchall()
            }
            if "candidate_profile" not in columns:
                conn.execute(text("ALTER TABLE cvs ADD COLUMN candidate_profile TEXT"))
