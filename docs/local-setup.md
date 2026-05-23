# Local Setup

## Prerequisites

- Node.js and npm.
- Docker Desktop.
- Python 3.12. The bundled Codex Python runtime can be used if system Python is not installed.

## Database

The backend runs immediately with a local SQLite file:

```text
services/api/local.db
```

Use PostgreSQL when Docker Desktop is running.

Start PostgreSQL locally:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

The PostgreSQL database URL is:

```text
postgresql+psycopg://ai_os:ai_os@localhost:5432/ai_os
```

To use PostgreSQL instead of SQLite, set:

```powershell
$env:DATABASE_URL="postgresql+psycopg://ai_os:ai_os@localhost:5432/ai_os"
```

## Backend

Create a virtual environment:

```powershell
& "C:\Users\madhu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m venv services/api/.venv
```

Install backend dependencies:

```powershell
services/api/.venv/Scripts/python.exe -m pip install -r services/api/requirements.txt
```

Run the backend:

```powershell
scripts/run-api.cmd
```

Health check:

```powershell
curl http://127.0.0.1:8000/api/health
```

## Frontend

Install frontend dependencies:

```powershell
npm.cmd install
```

Run the UI:

```powershell
scripts/run-web.cmd
```

Open:

```text
http://localhost:3000
```
