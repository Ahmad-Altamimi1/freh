-- Hand-written follow-up to 0000. Everything here is beyond what drizzle-kit
-- can express from the TypeScript schema: an expression-based unique index, a
-- trigram operator class, and row level security.
--
-- Kept in the same folder so `db:migrate` applies it in order. If the schema is
-- ever regenerated from scratch, this file must be preserved — drizzle-kit will
-- not recreate any of it.

-- Trigram matching, so quick search can use an index for `search_key ILIKE '%…%'`.
-- A plain btree cannot serve a leading-wildcard pattern; without this the search
-- degrades to a sequential scan on every keystroke.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE INDEX "organizations_search_key_trgm_idx"
  ON "organizations" USING gin ("search_key" gin_trgm_ops);
--> statement-breakpoint

-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- The app itself reaches this table through `getDb()`, which connects as the
-- owner and bypasses RLS regardless — so enabling it costs the app nothing and
-- closes the direct-API hole. Writes stay owner-only: no INSERT/UPDATE/DELETE
-- policy exists, so PostgREST can only read.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "organizations_authenticated_read"
  ON "organizations" FOR SELECT TO authenticated USING (true);
