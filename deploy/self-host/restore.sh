#!/usr/bin/env bash
#
# Restore the registry from a backup produced by backup.sh.
#
#   ./restore.sh /var/backups/registry/db-20260810-020000.sql.gz \
#                /var/backups/registry/storage-20260810-020000.tar.gz
#
# DESTRUCTIVE: overwrites the current database and storage volume. Intended for
# disaster recovery or for seeding a fresh server from the cloud export.
#
set -euo pipefail

DB_DUMP="${1:?usage: restore.sh <db-*.sql.gz> <storage-*.tar.gz>}"
STORAGE_TAR="${2:?usage: restore.sh <db-*.sql.gz> <storage-*.tar.gz>}"

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
STORAGE_VOLUME="${STORAGE_VOLUME:-supabase_storage}"

read -r -p "This OVERWRITES the live database and storage. Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "Aborted."; exit 1; }

echo "Restoring database from $DB_DUMP ..."
gunzip -c "$DB_DUMP" | docker exec -i "$DB_CONTAINER" psql -U postgres

echo "Restoring storage from $STORAGE_TAR ..."
docker run --rm \
  -v "${STORAGE_VOLUME}:/data" \
  -v "$(cd "$(dirname "$STORAGE_TAR")" && pwd):/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$STORAGE_TAR") -C /data"

echo "Done. Restart the stack:  docker compose restart"
