@echo off
REM APD CV Ranker - starts backend (FastAPI) and frontend (Vite) in separate windows.
setlocal

set ROOT=%~dp0

echo [1/4] Setting up Python backend...
cd /d "%ROOT%backend"
if not exist .venv (
  python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

if not exist .env (
  copy .env.example .env > nul
)

echo [2/4] Starting FastAPI on http://localhost:8000...
start "APD CV Ranker - Backend" cmd /k "cd /d %ROOT%backend && call .venv\Scripts\activate.bat && uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/4] Installing frontend dependencies...
cd /d "%ROOT%frontend"
if not exist node_modules (
  call npm install
)

echo [4/4] Starting Vite on http://localhost:5173...
start "APD CV Ranker - Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo ================================================================
echo   APD CV Ranker is starting up.
echo   Open http://localhost:5173 in your browser.
echo   Close the two opened terminal windows to stop the app.
echo ================================================================
endlocal
