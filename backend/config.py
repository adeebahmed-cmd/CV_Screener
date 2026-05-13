import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'apd.db'}")
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "10"))

# --- Auth config ---
# AUTH_TYPE controls which login method is active:
#   "none"     — no login required (single-user / local mode, default)
#   "password" — simple admin password set via ADMIN_PASSWORD in .env
#   "google"   — Google SSO (set GOOGLE_CLIENT_ID in .env)
#
# Priority: google > password > none
GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
ADMIN_PASSWORD:   str = os.getenv("ADMIN_PASSWORD",   "").strip()

if GOOGLE_CLIENT_ID:
    AUTH_TYPE = "google"
elif ADMIN_PASSWORD:
    AUTH_TYPE = "password"
else:
    AUTH_TYPE = "none"

AUTH_ENABLED: bool = AUTH_TYPE != "none"

# Secret used to sign JWTs. Auto-generated per-process if not set —
# set JWT_SECRET in .env to keep sessions alive across restarts.
JWT_SECRET: str = os.getenv("JWT_SECRET", "") or secrets.token_hex(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7
