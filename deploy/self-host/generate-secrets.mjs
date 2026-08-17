#!/usr/bin/env node
/**
 * Generates every secret the self-hosted Supabase stack and this app need.
 *
 * Dependency-free: signs the anon/service_role JWTs with Node's built-in crypto
 * (HS256), exactly the way Supabase's own generator does, so no npm install is
 * required on the target server.
 *
 * Run once, on the server, and paste the output into the two env files:
 *   node generate-secrets.mjs
 *
 * The same JWT_SECRET, ANON_KEY and SERVICE_ROLE_KEY must appear in BOTH the
 * Supabase stack `.env` and the app `.env.local` — that is why they are printed
 * together here. Keep this output secret; it is the keys to the whole system.
 */

import { createHmac, randomBytes } from 'node:crypto';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Sign a JWT the Supabase way: HS256 over {role, iss:'supabase', iat, exp}. */
function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const now = Math.floor(Date.now() / 1000);
const tenYears = now + 60 * 60 * 24 * 365 * 10;

// JWT secret must be at least 32 chars; 64 hex chars is comfortably above that.
const jwtSecret = randomBytes(32).toString('hex');
const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat: now, exp: tenYears }, jwtSecret);
const serviceKey = signJwt(
  { role: 'service_role', iss: 'supabase', iat: now, exp: tenYears },
  jwtSecret
);

// Passwords: url-safe, no shell-hostile characters, plenty of entropy.
const postgresPassword = randomBytes(24).toString('base64url');
const dashboardPassword = randomBytes(18).toString('base64url');
const cronSecret = randomBytes(24).toString('base64url');

// postgres-meta encrypts stored connection strings with this. It is read by
// both the `meta` and `studio` services and must be identical in each.
const pgMetaCryptoKey = randomBytes(32).toString('base64url');

const line = '='.repeat(70);
process.stdout.write(`
${line}
  GENERATED SECRETS — store securely, never commit to git
${line}

# ── 1) The server: paste into  /opt/registry/.env  ────────────────────
#     Both the Supabase stack and the app service read this one file.
POSTGRES_PASSWORD=${postgresPassword}
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=${dashboardPassword}
CRON_SECRET=${cronSecret}
PG_META_CRYPTO_KEY=${pgMetaCryptoKey}

# ── 2) Only if you run the app OUTSIDE docker: paste into .env.local ──
#     (URLs below use a placeholder IP — replace 10.0.0.5 with the real
#      ministry-LAN address of THIS server, and keep the port 8000.)
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.5:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}
SUPABASE_STORAGE_BUCKET=private
DATABASE_URL=postgresql://postgres:${postgresPassword}@10.0.0.5:5432/postgres
DIRECT_DATABASE_URL=postgresql://postgres:${postgresPassword}@10.0.0.5:5432/postgres
CRON_SECRET=${cronSecret}
NEXT_PUBLIC_SENTRY_DISABLED=true

${line}
`);
