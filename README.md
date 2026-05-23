# AI Institution OS

Open-source, role-aware, metadata-driven institution operating system.

## What Is Running

- Web UI: Next.js at `http://localhost:3000`.
- Backend API: FastAPI at `http://127.0.0.1:8000`.
- Local default database: SQLite at `services/api/local.db`.
- PostgreSQL Docker Compose config: `infra/docker-compose.yml`.

The current app includes seeded local login, role-specific workspaces, backend-configured navigation, metadata-rendered module records, and an attendance-to-action agent workflow.

## Run Locally

Install frontend packages:

```powershell
npm.cmd install
```

Create the backend virtual environment:

```powershell
& "C:\Users\madhu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m venv services/api/.venv
```

Install backend packages:

```powershell
services/api/.venv/Scripts/python.exe -m pip install -r services/api/requirements.txt
```

Start the API:

```powershell
scripts/run-api.cmd
```

Start the UI:

```powershell
scripts/run-web.cmd
```

## API Smoke Test

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health"
```

## PostgreSQL

When Docker Desktop is running, start PostgreSQL:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

Then run the API with:

```powershell
$env:DATABASE_URL="postgresql+psycopg://ai_os:ai_os@localhost:5432/ai_os"
scripts/run-api.cmd
```

SQLite remains the default so the MVP can run even when Docker is unavailable.
