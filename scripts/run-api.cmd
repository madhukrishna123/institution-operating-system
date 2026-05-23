@echo off
cd /d "%~dp0.."
services\api\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir services/api --port 8000

