#!/usr/bin/env node

/**
 * Creates a confirmed Supabase Auth user.
 *
 * There is no sign-up route in this app — users are provisioned deliberately.
 * This script is the scriptable equivalent of Authentication → Users → Add user
 * in the Supabase dashboard.
 *
 * Usage:
 *   node scripts/create-user.mjs <email> <password> [role]
 *
 * The password is read from your shell, never stored by this script. Prefer
 * passing it via an environment variable if you would rather it stay out of
 * your shell history — the positional password then disappears entirely, so
 * the next argument is the role:
 *
 *   NEW_USER_PASSWORD='...' node scripts/create-user.mjs someone@example.com [role]
 *
 * `role` is optional and is written to app_metadata, which only the service
 * role key can set — that is what makes it safe to authorize on. See
 * docs/nav-rbac.md.
 */

import fs from 'node:fs';
import path from 'node:path';

const ENV_FILES = ['.env.local', '.env'];

function loadEnv() {
  for (const file of ENV_FILES) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;

    return Object.fromEntries(
      fs
        .readFileSync(full, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].split(' #')[0].trim().replace(/^['"]|['"]$/g, '')])
    );
  }
  throw new Error(`No env file found. Expected one of: ${ENV_FILES.join(', ')}`);
}

const [email, ...rest] = process.argv.slice(2);

// With NEW_USER_PASSWORD set there is no positional password, so the next
// argument is the role. Reading argv[1] as the password regardless would turn
// `create-user.mjs someone@example.com admin` into an account whose password
// is literally "admin" — silently, since that clears the length check.
const envPassword = process.env.NEW_USER_PASSWORD;
const password = envPassword ?? rest[0];
const role = envPassword ? rest[0] : rest[1];

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password> [role]');
  console.error('   or: NEW_USER_PASSWORD=... node scripts/create-user.mjs <email> [role]');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Password must be at least 6 characters (Supabase minimum).');
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email,
    password,
    // No sign-up flow means no confirmation email would ever be clicked.
    email_confirm: true,
    ...(role ? { app_metadata: { role } } : {})
  })
});

const body = await res.json();

if (!res.ok) {
  console.error(`Failed (${res.status}): ${body.msg ?? body.message ?? JSON.stringify(body)}`);
  process.exit(1);
}

console.log(`Created user ${body.email}`);
console.log(`  id:           ${body.id}`);
console.log(`  confirmed:    ${body.email_confirmed_at ? 'yes' : 'no'}`);
console.log(`  app_metadata: ${JSON.stringify(body.app_metadata ?? {})}`);

if (role) {
  const dbUrl = env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('\n  DIRECT_DATABASE_URL not set — skipped user_roles insert.');
    console.warn('  Run the INSERT manually or set the env var.');
  } else {
    const { default: postgres } = await import('postgres');
    const sql = postgres(dbUrl, { max: 1 });
    try {
      const [assigned] = await sql`
        INSERT INTO user_roles (user_id, role_id)
        SELECT ${body.id}::uuid, r.id
        FROM roles r
        WHERE r.key = ${role}
        ON CONFLICT DO NOTHING
        RETURNING role_id
      `;
      if (assigned) {
        console.log(`  role:         ${role} (assigned in user_roles)`);
      } else {
        console.warn(`  role:         "${role}" not found in roles table — skipped.`);
      }
    } finally {
      await sql.end();
    }
  }
}

console.log('\nYou can now sign in at /auth/sign-in.');
