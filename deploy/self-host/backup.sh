#!/usr/bin/env bash
#
# Daily backup of the self-hosted Supabase stack.
#
#   • Database  — the registry's own data, in a form that can be restored over a
#                 LIVE database, gzip-compressed.
#   • Storage   — tar of the uploaded files volume.
#
# Everything the ministry's registry needs to be restored lives in these two
# artefacts. Keeps the last $RETENTION_DAYS days and deletes older ones.
#
# Schedule it from the host crontab (NOT inside a container), e.g. 02:00 daily:
#   0 2 * * *  /opt/registry/backup.sh >> /var/log/registry-backup.log 2>&1
#
# WHY NOT pg_dumpall
# ------------------
# A plain `pg_dumpall` cannot be restored onto a database that already has data:
# the tables exist, so every COPY aborts on its first duplicate key and psql —
# which does not stop on error — reports success having restored nothing. That
# failure is silent and only surfaces on the day the backup is needed.
#
# So the dump is written in three ordered parts that are safe to replay onto a
# live stack, mirroring the migration procedure in MIGRATION.md:
#
#   1. auth      — purge + reload users and identities (passwords included)
#   2. public    — --clean --if-exists, so tables are dropped and recreated
#   3. storage   — purge + reload the object index
#
# auth comes first because public.user_roles references auth.users.
#
# Roles, extensions and the auth/storage schemas themselves are NOT dumped: they
# belong to the Supabase images and are recreated by `docker compose up` on a
# fresh server. Restoring them as a non-superuser fails anyway.
#
set -euo pipefail

# --- config -----------------------------------------------------------------
STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # this folder
BACKUP_DIR="${BACKUP_DIR:-/var/backups/registry}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
# Docker volume name. Compose prefixes every volume with the project name, and
# the project here is `supabase` — hence the doubled word. Verify with
# `docker volume ls` before trusting a backup.
STORAGE_VOLUME="${STORAGE_VOLUME:-supabase_supabase_storage}"
#
# Image used to run tar. It MUST provide GNU tar: storage-api keeps each
# object's metadata (content type, cache control) in extended attributes on the
# file, and busybox tar — what `alpine` ships — silently drops them. Files then
# restore byte-identical and every download fails with
# "ENODATA: The extended attribute does not exist". Kong is already part of this
# stack, so using it costs no extra image on an air-gapped server.
TAR_IMAGE="${TAR_IMAGE:-kong:3.9.3}"
# ----------------------------------------------------------------------------

stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
db_file="$BACKUP_DIR/db-$stamp.sql.gz"

echo "[$(date)] Backing up database → $(basename "$db_file")"

# `pg_dump` reads PGPORT/PGDATABASE from the container's own environment, so no
# -p/-d here — that keeps this correct when POSTGRES_PORT is not 5432.
#
# --no-owner / --no-privileges / --no-comments are not cosmetic: Supabase's
# `postgres` role is deliberately NOT a superuser, so ALTER ... OWNER, GRANT,
# ALTER DEFAULT PRIVILEGES and COMMENT ON SCHEMA all fail during restore. With
# ON_ERROR_STOP that aborts the whole thing, and without it they are the noise
# that hides a real failure. Dumping them out is the fix.
#
PGDUMP_FLAGS=(-U postgres --no-owner --no-privileges --no-comments)

{
  echo '\set ON_ERROR_STOP on'
  echo 'BEGIN;'

  echo '-- 1) auth: purge, then reload. CASCADE also clears sessions and'
  echo '--    refresh tokens, which are meaningless after a restore anyway.'
  echo 'TRUNCATE auth.identities, auth.users CASCADE;'
  docker exec "$DB_CONTAINER" pg_dump "${PGDUMP_FLAGS[@]}" --data-only \
    --table=auth.users --table=auth.identities

  echo '-- 2) public: tables dropped and recreated by the dump itself, so'
  echo '--    foreign keys are re-added after the data instead of blocking it.'
  # The schema-level DROP/CREATE must go: `DROP SCHEMA public` fails because
  # extensions (pg_trgm) live in it, and the schema never needs recreating —
  # only its contents do.
  docker exec "$DB_CONTAINER" pg_dump "${PGDUMP_FLAGS[@]}" --schema=public --clean --if-exists \
    | grep -vE '^(DROP|CREATE) SCHEMA '

  echo '-- 3) storage: the object index. The files themselves are in the tar.'
  echo 'TRUNCATE storage.objects CASCADE;'
  docker exec "$DB_CONTAINER" pg_dump "${PGDUMP_FLAGS[@]}" --data-only --table=storage.objects

  echo 'COMMIT;'
} | gzip > "$db_file"

echo "[$(date)] Backing up storage volume → storage-$stamp.tar.gz"
# -u root: reading the root-owned volume and its extended attributes needs
# privileges the image's default user (kong runs as uid 1001) does not have.
docker run --rm -u root --entrypoint sh \
  -v "${STORAGE_VOLUME}:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  "$TAR_IMAGE" -c "tar czf '/backup/storage-$stamp.tar.gz' --xattrs --xattrs-include='*' -C /data ."

# A dump that restores nothing is the failure mode this script exists to avoid,
# so refuse to call a suspiciously small one a backup.
db_bytes="$(gzip -l "$db_file" | awk 'NR==2 {print $2}')"
if [ "${db_bytes:-0}" -lt 10000 ]; then
  echo "[$(date)] FAILED: uncompressed dump is only ${db_bytes} bytes — refusing to keep it." >&2
  rm -f "$db_file"
  exit 1
fi

echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'db-*.sql.gz'      -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Done. Current backups:"
ls -lh "$BACKUP_DIR"
