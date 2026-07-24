import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit runs outside Next.js, so it reads .env.local itself.
 * Use the DIRECT (session-mode, port 5432) connection string here — migrations
 * issue DDL and cannot run through the transaction-mode pooler on port 6543.
 */
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DIRECT_DATABASE_URL (or DATABASE_URL) must be set to run drizzle-kit. See env.example.txt.'
  );
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  // Supabase owns these schemas; never let drizzle-kit try to manage them.
  schemaFilter: ['public'],
  verbose: true,
  strict: true
});
