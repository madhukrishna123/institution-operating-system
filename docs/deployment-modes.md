# Deployment Modes

Institution OS supports two deployment modes.

## Mode 1: VPS Docker Mode

Use this for production or a serious pilot where you want one domain, HTTPS, PostgreSQL, backups, and full server control.

```text
https://yourdomain.com        -> Caddy -> Next.js web
https://yourdomain.com/api/*  -> Caddy -> FastAPI API
PostgreSQL                   -> Docker volume
```

Best for:

- Real production hosting
- A custom domain
- One controlled server
- Database persistence and backups
- Keeping web/API/database together

Files:

- `docker-compose.prod.yml`
- `infra/Caddyfile`
- `apps/web/Dockerfile`
- `services/api/Dockerfile`
- `.env.production.example`
- `docs/DEPLOYMENT.md`

Run:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Required production values:

```env
DOMAIN=app.example.com
POSTGRES_PASSWORD=strong-password
SECRET_KEY=long-random-secret
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=strong-admin-password
BOOTSTRAP_ADMIN_NAME=Institution Admin
BOOTSTRAP_INSTITUTION_NAME=Your Institution Name
```

## Mode 2: Standalone Mode

Use this for local work, a quick demo, or split hosting where the web is on Vercel and the API/database are on Render, Railway, or another API host.

```text
Local:
Next.js web   -> http://localhost:3001
FastAPI API   -> http://127.0.0.1:8000
SQLite        -> services/api/local.db

Hosted split:
Vercel web    -> https://your-web.vercel.app
External API  -> https://your-api-host.example.com
PostgreSQL    -> hosted database
```

Best for:

- Running locally
- One-day demos
- Vercel frontend hosting
- Render/Railway API hosting
- Keeping setup simple while the product is still changing

Files:

- `.env.standalone.example`
- `apps/web/.env.local.example`
- `scripts/run-api.cmd`
- `scripts/run-web.cmd`

Local run:

```powershell
copy .env.standalone.example .env
copy apps\web\.env.local.example apps\web\.env.local
scripts\run-api.cmd
scripts\run-web.cmd
```

For local production-style web on port `3001`:

```powershell
npm.cmd run build:web
cd apps\web
npx next start -p 3001
```

## Vercel Web + External API

Vercel should host only the Next.js web app. FastAPI and PostgreSQL should run somewhere else, such as Render, Railway, or a VPS.

Set Vercel project root to:

```text
apps/web
```

Set Vercel environment variables using either direct API mode:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com/api
```

or frontend rewrite mode:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_REWRITE_TARGET=https://your-api-host.example.com
```

The external API must set:

```env
ENVIRONMENT=production
WEB_ORIGIN=https://your-web.vercel.app
DATABASE_URL=postgresql+psycopg://...
SECRET_KEY=long-random-secret
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=strong-admin-password
BOOTSTRAP_ADMIN_NAME=Institution Admin
BOOTSTRAP_INSTITUTION_NAME=Your Institution Name
```

Note: many hosted databases provide URLs starting with `postgres://` or `postgresql://`. The API normalizes those to the installed `psycopg` driver automatically.

## Which Mode To Use

| Situation | Recommended Mode |
| --- | --- |
| One-day demo with least setup | Standalone mode with Vercel web + Render/Railway API |
| Demo from your laptop only | Standalone local mode |
| Real production launch | VPS Docker mode |
| Need one domain and `/api/*` routing | VPS Docker mode |
| Need frontend-only managed hosting | Vercel web + external API |

## Demo Checklist

1. Pick mode.
2. Set environment variables.
3. Start or deploy API.
4. Confirm `/api/health`.
5. Start or deploy web.
6. Login with bootstrap admin or local admin.
7. Create Academic Year, Class, Section, Student, Enrollment, Teacher, and Teaching Assignment.
