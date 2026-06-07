# Institution OS Deployment Runbook

## Choose A Deployment Mode

There are two supported modes:

- **VPS Docker mode**: production-style one-server deployment with Caddy, Next.js, FastAPI, and PostgreSQL.
- **Standalone mode**: local run, Vercel web plus external API, or short demos on Render/Railway.

Start with [deployment-modes.md](deployment-modes.md) if you are deciding where to host.

## Architecture

VPS Docker mode runs as one Docker Compose stack on a VPS.

```text
https://yourdomain.com       -> Caddy -> Next.js web
https://yourdomain.com/api/* -> Caddy -> FastAPI API
PostgreSQL                  -> persistent Docker volume
```

## First-Time VPS Setup

1. Install Docker and Docker Compose on Ubuntu.
2. Point your domain A record to the VPS public IP.
3. Copy the repository to the VPS.
4. Create `.env.production` from `.env.production.example`.
5. Use strong values for `POSTGRES_PASSWORD`, `SECRET_KEY`, and `BOOTSTRAP_ADMIN_PASSWORD`.

## Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Caddy automatically provisions HTTPS when `DOMAIN` points to the server.

## Smoke Test

```bash
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/ready
```

Then open `https://yourdomain.com` and sign in with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.

## Backups

Create a backup:

```bash
sh scripts/backup-postgres.sh
```

Restore a backup:

```bash
sh scripts/restore-postgres.sh backups/ai_os-YYYYMMDDTHHMMSSZ.dump
```

Backups are written to `./backups` and should also be copied to off-server storage.

## Local Development

```bash
scripts/run-api.cmd
scripts/run-web.cmd
npm.cmd run build:web
```

Local development keeps the seeded role picker. Production hides seeded users and requires email/password login.
