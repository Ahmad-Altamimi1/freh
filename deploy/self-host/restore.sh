#!/usr/bin/env bash
#
# Restore the registry from a backup produced by backup.sh.
#
#   ./restore.sh /var/backups/registry/db-20260810-020000.sql.gz \
#                /var/backups/registry/storage-20260810-020000.tar.gz
#
# DESTRUCTIVE: overwrites the current database contents and storage volume.
# Intended for disaster recovery or for seeding a fresh server.
#
# The dump produced by backup.sh is a single transaction that purges and reloads
# each part in dependency order, so it is safe to replay onto a live stack and
# either fully succeeds or leaves the database untouched.
#
set -euo pipefail

DB_DUMP="${1:?usage: restore.sh <db-*.sql.gz> <storage-*.tar.gz>}"
STORAGE_TAR="${2:?usage: restore.sh <db-*.sql.gz> <storage-*.tar.gz>}"

DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
# Compose prefixes volumes with the project name (`supabase`) — hence the
# doubled word. Must match backup.sh.
STORAGE_VOLUME="${STORAGE_VOLUME:-supabase_supabase_storage}"
# Must provide GNU tar — see the note in backup.sh. Restoring with busybox tar
# drops the extended attributes storage-api needs and every download 500s.
TAR_IMAGE="${TAR_IMAGE:-kong:3.9.3}"

for f in "$DB_DUMP" "$STORAGE_TAR"; do
  [ -f "$f" ] || { echo "Not found: $f" >&2; exit 1; }
done

read -r -p "This OVERWRITES the live database and storage. Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "Aborted."; exit 1; }

echo "Restoring database from $DB_DUMP ..."
# ON_ERROR_STOP is also set inside the dump; passing it here too covers the
# case where the file was produced by an older backup.sh that did not set it.
# Without it psql happily reports success after restoring nothing.
gunzip -c "$DB_DUMP" | docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q

echo "Restoring storage from $STORAGE_TAR ..."
# -u root: the volume's contents are root-owned and TAR_IMAGE may default to an
# unprivileged user (kong does), which fails to recreate the directory tree.
# Writing xattrs also needs privileges the image user does not have.
docker run --rm -u root --entrypoint sh \
  -v "${STORAGE_VOLUME}:/data" \
  -v "$(cd "$(dirname "$STORAGE_TAR")" && pwd):/backup:ro" \
  "$TAR_IMAGE" -c "rm -rf /data/* && tar xzf '/backup/$(basename "$STORAGE_TAR")' --xattrs --xattrs-include='*' -C /data"

# Report what actually landed. A restore that silently does nothing is the
# failure this script is built to make impossible — so prove it, do not assume.
echo
echo "Restored contents:"
docker exec "$DB_CONTAINER" psql -U postgres -tAc "
  select '  organizations : ' || count(*) from public.organizations
  union all select '  correspondences: ' || count(*) from public.correspondences
  union all select '  auth.users     : ' || count(*) from auth.users
  union all select '  storage.objects: ' || count(*) from storage.objects;"
# TAR_IMAGE, not alpine: pulling a second image would fail on an air-gapped
# server, and this one is already here — it just extracted the archive.
echo "  storage files  : $(docker run --rm -u root --entrypoint sh \
  -v "${STORAGE_VOLUME}:/data:ro" "$TAR_IMAGE" -c 'find /data -type f | wc -l' 2>/dev/null || echo '?')"

echo
echo "Done. Restart the stack:  docker compose restart"
