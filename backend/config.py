import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'apd.db'}")
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "10"))
