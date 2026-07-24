/**
 * Drizzle schema — intentionally empty.
 *
 * The business data model is defined by the application owner, not by this
 * scaffold. Nothing here should describe products, categories, users, images,
 * or any other domain entity.
 *
 * To add a table:
 *
 *   1. Create `src/db/schema/<entity>.ts`:
 *
 *        import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
 *
 *        export const example = pgTable('example', {
 *          id: uuid('id').primaryKey().defaultRandom(),
 *          createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
 *        });
 *
 *   2. Re-export it from this file so drizzle-kit and `db` both see it:
 *
 *        export * from './example';
 *
 *   3. Generate and apply the migration:
 *
 *        bun run db:generate
 *        bun run db:migrate
 *
 * Note on Supabase: tables created this way have Row Level Security DISABLED by
 * default. Enable it and add policies for every table the anon/authenticated
 * roles can reach, or the table is readable by anyone holding the anon key.
 */

/**
 * Placeholder so this file is a module while no tables exist. Harmless to keep,
 * safe to delete once you export your first table.
 */
export type BusinessSchema = Record<string, never>;
