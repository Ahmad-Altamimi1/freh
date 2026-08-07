/**
 * Drizzle schema — the barrel drizzle-kit and `getDb()` both read.
 *
 * To add a table: create `src/db/schema/<entity>.ts`, re-export it here, then
 * run `bun run db:generate` and `bun run db:migrate`.
 *
 * Note on Supabase: tables created this way have Row Level Security DISABLED by
 * default. Enable it and add policies for every table the anon/authenticated
 * roles can reach, or the table is readable by anyone holding the anon key.
 * `src/db/migrations/0001_organizations_indexes.sql` does this for
 * `organizations`; do the same for anything added later.
 */

export * from './organizations';
export * from './notifications';
export * from './correspondences';
