#!/usr/bin/env bash
# Run this once after any code changes to rebuild and restart the service.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] Building frontend..."
cd "$ROOT/frontend"
npm install --silent
npm run build

echo "[2/3] Installing backend dependencies..."
cd "$ROOT/backend"
source .venv/bin/activate
pip install --quiet -r requirements.txt

echo "[3/3] Restarting service..."
sudo systemctl restart hr-screener

echo ""
echo "Done! App is running at http://localhost:8000"
