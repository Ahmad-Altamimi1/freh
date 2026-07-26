import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * Drizzle database client over a pooled Postgres connection.
 *
 * Connection notes for Supabase on serverless:
 *  - `DATABASE_URL` should be the transaction-mode pooler (port 6543) so each
 *    invocation borrows a connection instead of opening its own.
 *  - `prepare: false` is required with that pooler — prepared statements are
 *    not supported in transaction mode.
 *  - `max` must be > 1. A single request fans out concurrent queries with
 *    `Promise.all` (the listing runs its rows + count together; the facets and
 *    the report do the same). With `max: 1` postgres-js pipelines those onto one
 *    socket, and Supabase's transaction pooler cancels the pipelined statement
 *    with `57014 statement timeout` — which surfaces as a page that hangs on its
 *    loading skeleton forever. A small pool lets each concurrent query take its
 *    own pooled connection. Keep it modest so that instances × max stays well
 *    under the pooler's connection ceiling.
 *
 * This client connects as the Postgres owner and therefore BYPASSES Row Level
 * Security. Every query here is trusted server code — do your authorization
 * check (`requireUser()`, role checks) before you reach for `db`. For queries
 * that should run as the signed-in user under RLS, use the Supabase client from
 * `@/lib/supabase/server` instead.
 *
 * The instance is cached on `globalThis` so Next.js dev hot-reloads reuse one
 * pool rather than leaking a new one on every recompile.
 */

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

function getClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(getServerEnv().DATABASE_URL, {
      max: 10,
      prepare: false
    });
  }
  return globalForDb.postgresClient;
}

/**
 * Lazily created so that merely importing this module never opens a socket or
 * requires DATABASE_URL to be present — important for builds and for client
 * bundles that transitively touch server code.
 */
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('getDb() was called in the browser. Database access is server-only.');
  }
  cachedDb ??= drizzle(getClient(), { schema });
  return cachedDb;
}

export { schema };
