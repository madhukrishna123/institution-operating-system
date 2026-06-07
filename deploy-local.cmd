@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "ROOT=%CD%"
set "API_PORT=8000"
set "WEB_PORT=3001"
set "API_URL=http://127.0.0.1:%API_PORT%"
set "WEB_URL=http://localhost:%WEB_PORT%"
set "PYTHON_EXE=%ROOT%\services\api\.venv\Scripts\python.exe"

echo.
echo ================================================
echo  Institution OS - Standalone Local Deployment
echo ================================================
echo.

if not exist ".env" (
  echo Creating .env from .env.standalone.example
  copy ".env.standalone.example" ".env" >nul
)

if not exist "apps\web\.env.local" (
  echo Creating apps\web\.env.local from example
  copy "apps\web\.env.local.example" "apps\web\.env.local" >nul
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js / npm was not found.
  echo Install Node.js 22 LTS, then run deploy-local.cmd again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing web dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

if not exist "%PYTHON_EXE%" (
  echo Creating Python virtual environment...
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3.12 -m venv services\api\.venv
  ) else (
    where python >nul 2>nul
    if errorlevel 1 (
      echo ERROR: Python was not found.
      echo Install Python 3.12, then run deploy-local.cmd again.
      pause
      exit /b 1
    )
    python -m venv services\api\.venv
  )
  if errorlevel 1 goto :failed
)

echo Installing API dependencies...
"%PYTHON_EXE%" -m pip install -r services\api\requirements.txt
if errorlevel 1 goto :failed

echo Building web app...
call npm.cmd run build:web
if errorlevel 1 goto :failed

echo Stopping any existing local API/web processes on ports %API_PORT% and %WEB_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports=@(%API_PORT%,%WEB_PORT%); foreach($port in $ports){ $processId=(Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object State -eq 'Listen' | Select-Object -First 1 -ExpandProperty OwningProcess); if($processId){ Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue } }"

echo Starting API on %API_URL% ...
start "Institution OS API" /D "%ROOT%" cmd /k ""%PYTHON_EXE%" -m uvicorn app.main:app --app-dir services/api --port %API_PORT%"

echo Waiting for API health...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0;$i -lt 30;$i++){ try{ $r=Invoke-RestMethod '%API_URL%/api/health' -TimeoutSec 2; if($r.status -eq 'ok'){ $ok=$true; break } } catch{}; Start-Sleep -Seconds 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo ERROR: API did not become healthy on %API_URL%.
  pause
  exit /b 1
)

echo Starting web app on %WEB_URL% ...
start "Institution OS Web" /D "%ROOT%" cmd /k "npm.cmd run start:web:3001"

echo Waiting for web app...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0;$i -lt 30;$i++){ try{ $r=Invoke-WebRequest '%WEB_URL%' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } } catch{}; Start-Sleep -Seconds 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo ERROR: Web app did not become available on %WEB_URL%.
  pause
  exit /b 1
)

echo.
echo Local deployment is running.
echo Web: %WEB_URL%
echo API: %API_URL%/api/health
echo.
echo Login:
echo   Username: admin@nova.local
echo   Password: password
echo.
start "" "%WEB_URL%"
pause
exit /b 0

:failed
echo.
echo ERROR: Local deployment failed. Review the messages above.
pause
exit /b 1
