#!/usr/bin/env bash
#
# Daily backup of the self-hosted Supabase stack.
#
#   • Database  — full pg_dump (schema + data + auth.users), gzip-compressed.
#   • Storage   — tar of the uploaded files volume.
#
# Everything the ministry's registry needs to be restored lives in these two
# artefacts. Keeps the last $RETENTION_DAYS days and deletes older ones.
#
# Schedule it from the host crontab (NOT inside a container), e.g. 02:00 daily:
#   0 2 * * *  /opt/supabase/deploy/self-host/backup.sh >> /var/log/registry-backup.log 2>&1
#
set -euo pipefail

# --- config -----------------------------------------------------------------
STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # this folder
BACKUP_DIR="${BACKUP_DIR:-/var/backups/registry}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
STORAGE_VOLUME="${STORAGE_VOLUME:-supabase_storage}"        # docker volume name
# ----------------------------------------------------------------------------

stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Backing up database → db-$stamp.sql.gz"
docker exec -t "$DB_CONTAINER" pg_dumpall -U postgres \
  | gzip > "$BACKUP_DIR/db-$stamp.sql.gz"

echo "[$(date)] Backing up storage volume → storage-$stamp.tar.gz"
docker run --rm \
  -v "${STORAGE_VOLUME}:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/storage-$stamp.tar.gz" -C /data .

echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'db-*.sql.gz'      -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Done. Current backups:"
ls -lh "$BACKUP_DIR"
