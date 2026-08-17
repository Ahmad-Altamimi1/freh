#!/usr/bin/env bash
#
# Bring the associations registry up on a bare Ubuntu server — from a machine
# with nothing installed to a verified, running stack.
#
#   sudo ./bootstrap.sh --ip 10.0.0.5 --fresh
#   sudo ./bootstrap.sh --ip 10.0.0.5 --restore db-*.sql.gz storage-*.tar.gz
#
# Every stage here exists because the manual procedure failed at it during a
# full rehearsal. The checks are not ceremony — each one maps to a specific way
# this install has already been seen to break.
#
# WHAT IT DOES NOT DO
#   • Build the app image. That needs the source and a toolchain, and the image
#     is tied to --ip at build time, so it is built elsewhere and loaded here
#     with --app-image.
#   • Open the firewall. Deliberately: exposing a port is the operator's call.
#
set -euo pipefail

# --- defaults ---------------------------------------------------------------
STACK_DIR="${STACK_DIR:-/opt/registry}"
# The last self-hosted release that still uses Kong. The next one replaced it
# with Envoy, and volumes/ from that era does not work with these image tags.
# volumes/ and the image tags in docker-compose.yml are ONE set — do not bump
# this without bumping those together.
SUPABASE_COMMIT="9e225a279b33e4e6e1452e573a40a6a25aa2cb2f"
IP=""
MODE=""
RESTORE_DB=""
RESTORE_STORAGE=""
APP_IMAGE_TAR=""
ADMIN_EMAIL="admin@registry.local"
APP_PORT="3000"
KONG_PORT="8000"
PG_PUBLISHED_PORT="5432"
# ----------------------------------------------------------------------------

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'EOF'
Usage:
  bootstrap.sh --ip <server-ip> --fresh [options]
  bootstrap.sh --ip <server-ip> --restore <db-*.sql.gz> <storage-*.tar.gz> [options]

Required:
  --ip <addr>            This server's LAN address or DNS name. Every service is
                         configured to it and the app image must be built for the
                         same value. Must NOT be localhost — other PCs resolve
                         that to themselves.
Mode (pick one):
  --fresh                Empty registry: apply migrations, create an admin user.
  --restore <db> <store> Restore a backup.sh pair (use this when migrating).

Options:
  --dir <path>           Install directory (default: /opt/registry)
  --app-image <file.tar.gz>  docker load this image and start the app service.
  --admin-email <email>  Admin account for --fresh (default: admin@registry.local)
  --app-port <n>         Published app port (default: 3000)
  --kong-port <n>        Published Supabase gateway port (default: 8000)
  --pg-port <n>          Published Postgres port (default: 5432)
EOF
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --ip)          IP="${2:?}"; shift 2 ;;
    --fresh)       MODE="fresh"; shift ;;
    --restore)     MODE="restore"; RESTORE_DB="${2:?}"; RESTORE_STORAGE="${3:?}"; shift 3 ;;
    --dir)         STACK_DIR="${2:?}"; shift 2 ;;
    --app-image)   APP_IMAGE_TAR="${2:?}"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="${2:?}"; shift 2 ;;
    --app-port)    APP_PORT="${2:?}"; shift 2 ;;
    --kong-port)   KONG_PORT="${2:?}"; shift 2 ;;
    --pg-port)     PG_PUBLISHED_PORT="${2:?}"; shift 2 ;;
    -h|--help)     usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[ -n "$IP" ] || { echo "--ip is required." >&2; usage; }
[ -n "$MODE" ] || { echo "Pick --fresh or --restore." >&2; usage; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '    \033[31m✘ %s\033[0m\n' "$1" >&2; exit 1; }

# =============================================================================
step "1/9  Preflight"
# =============================================================================

# Root is required only for what actually needs it: installing Docker, and
# writing to a directory the invoking user does not own. Demanding it
# unconditionally forces `sudo` even for a user-owned install, and under sudo the
# environment loses any per-user Docker configuration — which fails several
# stages later with a confusing socket error instead of here.
if [ "$(id -u)" -ne 0 ]; then
  command -v docker >/dev/null 2>&1 \
    || die "Docker is not installed, so root is required. Re-run with sudo."
  parent="$STACK_DIR"; while [ ! -e "$parent" ]; do parent="$(dirname "$parent")"; done
  [ -w "$parent" ] \
    || die "$STACK_DIR is not writable by $(whoami). Re-run with sudo, or pass --dir to a path you own."
fi

case "$IP" in
  localhost|127.0.0.1|0.0.0.0)
    die "--ip must be the address other machines use to reach this server, not $IP." ;;
esac
ok "Address: $IP"

# A port that is already taken is the failure that wastes the most time: the
# stack starts, and the app silently talks to whatever else is listening. That
# surfaces as "password authentication failed" against a database you are not
# looking at.
port_busy() {
  if command -v ss >/dev/null 2>&1; then ss -lnt "sport = :$1" 2>/dev/null | grep -q LISTEN
  else netstat -lnt 2>/dev/null | grep -qE "[:.]$1[[:space:]]"; fi
}
for p in "$APP_PORT" "$KONG_PORT" "$PG_PUBLISHED_PORT"; do
  port_busy "$p" && die "Port $p is already in use. Pick another with --app-port/--kong-port/--pg-port."
done
ok "Ports $APP_PORT, $KONG_PORT, $PG_PUBLISHED_PORT are free"

if [ "$MODE" = "restore" ]; then
  [ -f "$RESTORE_DB" ]      || die "Not found: $RESTORE_DB"
  [ -f "$RESTORE_STORAGE" ] || die "Not found: $RESTORE_STORAGE"
  RESTORE_DB="$(cd "$(dirname "$RESTORE_DB")" && pwd)/$(basename "$RESTORE_DB")"
  RESTORE_STORAGE="$(cd "$(dirname "$RESTORE_STORAGE")" && pwd)/$(basename "$RESTORE_STORAGE")"
  ok "Backup pair found"
fi

MIGRATIONS_DIR=""
if [ "$MODE" = "fresh" ]; then
  for candidate in "$SRC_DIR/migrations" "$SRC_DIR/../../src/db/migrations"; do
    [ -f "$candidate/meta/_journal.json" ] && { MIGRATIONS_DIR="$(cd "$candidate" && pwd)"; break; }
  done
  [ -n "$MIGRATIONS_DIR" ] || die "Migrations not found. Copy src/db/migrations next to this script as ./migrations."
  ok "Migrations: $MIGRATIONS_DIR"
fi

[ -n "$APP_IMAGE_TAR" ] && { [ -f "$APP_IMAGE_TAR" ] || die "Not found: $APP_IMAGE_TAR"; }

# =============================================================================
step "2/9  Docker"
# =============================================================================

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Already installed: $(docker --version | cut -d, -f1)"
else
  [ "$(id -u)" -eq 0 ] || die "Installing Docker needs root. Re-run with sudo."
  echo "    Installing Docker Engine + Compose plugin ..."
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker compose version >/dev/null 2>&1 || die "Compose plugin missing after install."
  ok "Installed: $(docker --version | cut -d, -f1)"
  if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER" || true
    warn "Added $SUDO_USER to the docker group — log out and back in to use docker without sudo."
  fi
fi

# A present `docker` binary does not mean a reachable daemon: the client is
# installed on its own by some setups, and Docker Desktop's WSL integration
# exposes it per-user so it vanishes under sudo. Catch that here, with the fix,
# rather than three stages later as "failed to connect to the docker API".
if ! docker info >/dev/null 2>&1; then
  systemctl start docker >/dev/null 2>&1 || true
  sleep 3
  docker info >/dev/null 2>&1 || die \
    "The docker daemon is not reachable$([ -n "${SUDO_USER:-}" ] && echo " as root (it may work as $SUDO_USER — Docker Desktop exposes it per-user)"). Start it, or install Docker Engine on this machine."
fi
ok "Daemon reachable"

# =============================================================================
step "3/9  Install directory"
# =============================================================================

mkdir -p "$STACK_DIR"
for f in docker-compose.yml backup.sh restore.sh generate-secrets.mjs copy-storage.mjs; do
  [ -f "$SRC_DIR/$f" ] && cp "$SRC_DIR/$f" "$STACK_DIR/"
done
chmod +x "$STACK_DIR"/*.sh 2>/dev/null || true
ok "Stack files in $STACK_DIR"

# volumes/ holds the Postgres init scripts and Kong's routing table. They are
# version-locked to the image tags in docker-compose.yml, which is why the
# checkout is pinned. An existing volumes/ is left alone: that is how an
# air-gapped install works — ship the folder, skip the clone.
if [ -f "$STACK_DIR/volumes/api/kong.yml" ]; then
  ok "volumes/ already present — not re-fetching"
else
  echo "    Fetching Supabase config at pinned commit ${SUPABASE_COMMIT:0:8} ..."
  rm -rf "$STACK_DIR/_sb"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase "$STACK_DIR/_sb" >/dev/null 2>&1 \
    || die "git clone failed. On an offline server, copy a volumes/ folder into $STACK_DIR instead."
  ( cd "$STACK_DIR/_sb" \
      && git sparse-checkout set docker >/dev/null \
      && git fetch --depth 1 origin "$SUPABASE_COMMIT" >/dev/null 2>&1 \
      && git checkout FETCH_HEAD >/dev/null 2>&1 )
  cp -r "$STACK_DIR/_sb/docker/volumes" "$STACK_DIR/volumes"
  rm -rf "$STACK_DIR/_sb"
fi

# Two files, not one: kong-entrypoint.sh only exists in the Kong-era layout. Its
# absence means volumes/ came from a different release than the image tags.
for required in api/kong.yml api/kong-entrypoint.sh db/roles.sql db/jwt.sql; do
  [ -f "$STACK_DIR/volumes/$required" ] || die "volumes/$required missing — wrong Supabase revision."
done
ok "Supabase config verified (kong.yml + kong-entrypoint.sh + db init)"

# =============================================================================
step "4/9  Secrets and .env"
# =============================================================================

if [ -f "$STACK_DIR/.env" ]; then
  ok ".env already exists — keeping it"
else
  # Same HS256 scheme Supabase's own generator uses. anon and service_role are
  # signed with JWT_SECRET, so the three are one set and cannot be mixed.
  read -r POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY DASHBOARD_PASSWORD CRON_SECRET PG_META_CRYPTO_KEY <<EOF
$(docker run --rm -v "$SRC_DIR:/s:ro" node:22-slim node -e '
const { createHmac, randomBytes } = require("node:crypto");
const b64 = (i) => Buffer.from(i).toString("base64url");
const sign = (p, s) => { const d = b64(JSON.stringify({alg:"HS256",typ:"JWT"})) + "." + b64(JSON.stringify(p));
  return d + "." + createHmac("sha256", s).update(d).digest("base64url"); };
const now = Math.floor(Date.now()/1000), exp = now + 60*60*24*365*10;
const jwt = randomBytes(32).toString("hex");
process.stdout.write([
  randomBytes(24).toString("base64url"), jwt,
  sign({role:"anon",iss:"supabase",iat:now,exp}, jwt),
  sign({role:"service_role",iss:"supabase",iat:now,exp}, jwt),
  randomBytes(18).toString("base64url"), randomBytes(24).toString("base64url"),
  randomBytes(32).toString("base64url")
].join(" "));')
EOF
  [ -n "$SERVICE_ROLE_KEY" ] || die "Secret generation failed."

  cat > "$STACK_DIR/.env" <<EOF
# Generated by bootstrap.sh — keep secret, never commit.
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
CRON_SECRET=$CRON_SECRET
PG_META_CRYPTO_KEY=$PG_META_CRYPTO_KEY

POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PUBLISHED_PORT=$PG_PUBLISHED_PORT

JWT_EXPIRY=3600

# The browser talks to Supabase directly, so these must be the address other
# machines use — never localhost.
SITE_URL=http://$IP:$APP_PORT
API_EXTERNAL_URL=http://$IP:$KONG_PORT
SUPABASE_PUBLIC_URL=http://$IP:$KONG_PORT
ADDITIONAL_REDIRECT_URLS=http://$IP:$APP_PORT

DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false

KONG_HTTP_PORT=$KONG_PORT
KONG_HTTPS_PORT=8443

PGRST_DB_SCHEMAS=public,storage

STUDIO_DEFAULT_ORGANIZATION=Ministry
STUDIO_DEFAULT_PROJECT=Registry
IMGPROXY_AUTO_WEBP=true

# Opaque sb_ keys are intentionally empty: Kong's entrypoint then falls back to
# the legacy HS256 keys generated above.
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ANON_KEY_ASYMMETRIC=
SERVICE_ROLE_KEY_ASYMMETRIC=

APP_IMAGE=registry-app:latest
APP_PORT=$APP_PORT
SUPABASE_STORAGE_BUCKET=private
TERM_END_NOTICE_DAYS=10
EOF
  chmod 600 "$STACK_DIR/.env"
  ok "Secrets generated, .env written (mode 600)"
fi

set -a; . "$STACK_DIR/.env"; set +a
SUPA="http://$IP:$KONG_PORT"

# =============================================================================
step "5/9  Starting Supabase"
# =============================================================================

cd "$STACK_DIR"
docker compose up -d >/dev/null
echo "    Waiting for services to report healthy ..."

deadline=$(( $(date +%s) + 300 ))
while :; do
  unhealthy="$(docker compose ps --format '{{.Name}} {{.Status}}' \
    | grep -vE 'healthy|Up [0-9]+ (second|minute|hour)' | awk '{print $1}' || true)"
  [ -z "$unhealthy" ] && break
  [ "$(date +%s)" -gt "$deadline" ] && {
    docker compose ps
    die "Timed out. Check: docker compose logs ${unhealthy%% *}"
  }
  sleep 5
done
ok "$(docker compose ps --format '{{.Name}}' | wc -l) containers healthy"

# =============================================================================
step "6/9  Storage bucket"
# =============================================================================

bucket_code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SUPA/storage/v1/bucket" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"id":"private","name":"private","public":false}')"
case "$bucket_code" in
  200|201) ok "Bucket 'private' created (not public)" ;;
  409)     ok "Bucket 'private' already exists" ;;
  *)       die "Could not create bucket (HTTP $bucket_code)" ;;
esac

# =============================================================================
step "7/9  Database"
# =============================================================================

# `< /dev/null` is load-bearing. `docker compose exec -T` reads stdin, and this
# helper is called from inside a `while read` loop whose stdin is the list of
# migrations — without it the first call swallows the rest of the list and the
# loop exits after one file, having applied exactly one migration.
psql_q() { docker compose exec -T db psql -U postgres -tAq "$@" < /dev/null; }

if [ "$MODE" = "fresh" ]; then
  # Applied with psql rather than drizzle-kit: the server has no Node and may
  # have no internet. The journal row is written by hand so a later
  # `drizzle-kit migrate` from a workstation sees these as already applied —
  # drizzle keys on sha256 of the file contents, verified against a real
  # database before this was written.
  psql_q -c 'CREATE SCHEMA IF NOT EXISTS drizzle;' \
         -c 'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);' >/dev/null

  applied=0
  while read -r tag when; do
    [ -n "$tag" ] || continue
    file="$MIGRATIONS_DIR/$tag.sql"
    [ -f "$file" ] || die "Journal lists $tag but $file is missing."
    hash="$(sha256sum "$file" | cut -d' ' -f1)"

    if [ -n "$(psql_q -c "select 1 from drizzle.__drizzle_migrations where hash='$hash'")" ]; then
      continue
    fi
    docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -q < "$file" \
      || die "Migration $tag failed."
    psql_q -c "insert into drizzle.__drizzle_migrations (hash, created_at) values ('$hash', $when)" >/dev/null
    applied=$(( applied + 1 ))
  done < <(node -e '
      const j = require(process.argv[1] + "/meta/_journal.json");
      for (const e of j.entries) console.log(e.tag, e.when);
    ' "$MIGRATIONS_DIR" 2>/dev/null || docker run --rm -v "$MIGRATIONS_DIR:/m:ro" node:22-slim node -e '
      const j = require("/m/meta/_journal.json");
      for (const e of j.entries) console.log(e.tag, e.when);
    ')

  ok "$applied migration(s) applied"

  tables="$(psql_q -c "select count(*) from pg_tables where schemaname='public'")"
  [ "${tables:-0}" -gt 0 ] || die "No tables in public after migrating."
  ok "$tables tables in public"

  # --- admin user ---
  ADMIN_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' )Aa1!"
  created="$(curl -s -X POST "$SUPA/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"email_confirm\":true,\"app_metadata\":{\"role\":\"admin\"}}")"
  user_id="$(printf '%s' "$created" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
  [ -n "$user_id" ] || die "Could not create the admin user: $created"

  psql_q -c "insert into user_roles (user_id, role_id) select '$user_id'::uuid, r.id from roles r where r.key='admin' on conflict do nothing" >/dev/null
  ok "Admin user created and granted the admin role"
else
  STACK_DIR="$STACK_DIR" bash "$STACK_DIR/restore.sh" "$RESTORE_DB" "$RESTORE_STORAGE" <<< "yes"
  ok "Restored from backup"
fi

# =============================================================================
step "8/9  Application"
# =============================================================================

if [ -n "$APP_IMAGE_TAR" ]; then
  echo "    Loading $APP_IMAGE_TAR ..."
  gunzip -c "$APP_IMAGE_TAR" 2>/dev/null | docker load >/dev/null || docker load -i "$APP_IMAGE_TAR" >/dev/null
  docker compose --profile app up -d >/dev/null
  sleep 10
  ok "App started on port $APP_PORT"
else
  warn "No --app-image given. Build it on a machine with the source and internet:"
  echo
  echo "      docker build \\"
  echo "        --build-arg NEXT_PUBLIC_SUPABASE_URL=$SUPA \\"
  echo "        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \\"
  echo "        -t registry-app:latest ."
  echo "      docker save registry-app:latest | gzip > registry-app.tar.gz"
  echo
  echo "    Then move it here and run:  sudo $0 --ip $IP --fresh --app-image registry-app.tar.gz"
fi

# =============================================================================
step "9/9  Verification"
# =============================================================================

check() { # name expected-code url [auth]
  code="$(curl -s -o /dev/null -w '%{http_code}' "$3" ${4:+-H "apikey: $4"} ${4:+-H "Authorization: Bearer $4"})"
  [ "$code" = "$2" ] && ok "$1 → $code" || die "$1 → $code (expected $2)"
}
check "Auth"    200 "$SUPA/auth/v1/health" "$ANON_KEY"
check "REST"    200 "$SUPA/rest/v1/"       "$SERVICE_ROLE_KEY"
check "Storage" 200 "$SUPA/storage/v1/bucket" "$SERVICE_ROLE_KEY"
check "Studio"  401 "$SUPA/"

if [ -n "$APP_IMAGE_TAR" ]; then
  check "App" 200 "http://$IP:$APP_PORT/auth/sign-in"
fi

cat <<EOF

$(printf '\033[1m%s\033[0m' "Done.")

  Registry     http://$IP:$APP_PORT
  Studio       $SUPA        (admin / see DASHBOARD_PASSWORD in $STACK_DIR/.env)
EOF

if [ "$MODE" = "fresh" ]; then
  cat <<EOF

  Sign in with:
    $ADMIN_EMAIL
    $ADMIN_PASSWORD

  This password is shown once and is not stored anywhere. Change it after the
  first sign-in.
EOF
fi

cat <<EOF

  Next:
    • Open the firewall for $APP_PORT and $KONG_PORT on the internal network only.
    • Schedule backups:  0 2 * * *  $STACK_DIR/backup.sh >> /var/log/registry-backup.log 2>&1
    • Test a restore before going live — see README.md.
EOF
