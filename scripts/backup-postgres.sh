#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DATABASE="${POSTGRES_DB:-ai_os}"
USER="${POSTGRES_USER:-ai_os}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/${DATABASE}-${STAMP}.dump"

mkdir -p "${BACKUP_DIR}"

docker compose -f "${COMPOSE_FILE}" exec -T "${SERVICE}" \
  pg_dump -U "${USER}" -d "${DATABASE}" --format=custom --no-owner --no-acl \
  > "${BACKUP_FILE}"

echo "Wrote ${BACKUP_FILE}"
