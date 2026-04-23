#!/usr/bin/env bash
# APD CV Ranker — starts backend (FastAPI) and frontend (Vite) together.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# -------- Backend --------
echo "[1/4] Setting up Python backend…"
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

echo "[2/4] Starting FastAPI on http://localhost:8000…"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# -------- Frontend --------
echo "[3/4] Installing frontend dependencies…"
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "[4/4] Starting Vite on http://localhost:5173…"
npm run dev &
FRONTEND_PID=$!

trap "echo 'Stopping…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
