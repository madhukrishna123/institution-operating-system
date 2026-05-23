#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 backups/ai_os-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DATABASE="${POSTGRES_DB:-ai_os}"
USER="${POSTGRES_USER:-ai_os}"
BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

cat "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T "${SERVICE}" \
  pg_restore -U "${USER}" -d "${DATABASE}" --clean --if-exists --no-owner --no-acl

echo "Restored ${BACKUP_FILE} into ${DATABASE}"
