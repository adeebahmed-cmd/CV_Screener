@echo off
REM APD CV Ranker - starts backend and frontend without opening extra console windows.
setlocal

set ROOT=%~dp0
set PYTHON=%ROOT%backend\.venv\Scripts\python.exe
set NODE_DIR=C:\Program Files\nodejs
set NPM=%NODE_DIR%\npm.cmd

echo [1/4] Setting up Python backend...
cd /d "%ROOT%backend"
if not exist .venv (
  py -3.11 -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

if not exist .env (
  copy .env.example .env > nul
)

echo [2/4] Ensuring frontend dependencies are installed...
cd /d "%ROOT%frontend"
if not exist node_modules (
  set "PATH=%NODE_DIR%;%PATH%"
  call "%NPM%" install
)

echo [3/4] Starting backend and frontend in the background...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [System.IO.Path]::GetFullPath('%ROOT%');" ^
  "$python = Join-Path $root 'backend\.venv\Scripts\python.exe';" ^
  "$backendDir = Join-Path $root 'backend';" ^
  "$frontendDir = Join-Path $root 'frontend';" ^
  "$npm = '%NPM%';" ^
  "$nodeDir = '%NODE_DIR%';" ^
  "$backend = Start-Process -FilePath $python -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','8000','--reload' -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru;" ^
  "$frontendCmd = '/c set PATH=' + $nodeDir + ';%PATH%&& cd /d \"' + $frontendDir + '\" && \"' + $npm + '\" run dev -- --host 127.0.0.1 --port 5173';" ^
  "$frontend = Start-Process -FilePath 'cmd.exe' -ArgumentList $frontendCmd -WindowStyle Hidden -PassThru;" ^
  "Start-Sleep -Seconds 4;" ^
  "Start-Process 'http://localhost:5173';" ^
  "Write-Host ('Backend PID: ' + $backend.Id);" ^
  "Write-Host ('Frontend PID: ' + $frontend.Id);"

echo [4/4] APD CV Ranker is starting.
echo Open http://localhost:5173 if the browser did not open automatically.
echo.
echo No extra command windows were opened.
echo To stop the app later, close it from Task Manager or restart the machine.
endlocal
