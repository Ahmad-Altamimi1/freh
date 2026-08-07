-- Hand-written follow-up to 0007. Mirrors 0001_organizations_indexes.sql's
-- role for `organizations`. Kept in the same folder so `db:migrate` applies it
-- in order; if the schema is ever regenerated from scratch, this file must be
-- preserved — drizzle-kit will not recreate it.

-- pg_trgm was already created by 0001_organizations_indexes.sql — extensions
-- are database-wide, not per-table, so it is not re-issued here.
CREATE INDEX "correspondences_search_key_trgm_idx"
  ON "correspondences" USING gin ("search_key" gin_trgm_ops);
--> statement-breakpoint

-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- The app itself reaches this table through `getDb()`, which connects as the
-- owner and bypasses RLS regardless — so enabling it costs the app nothing and
-- closes the direct-API hole. Writes stay owner-only: no INSERT/UPDATE/DELETE
-- policy exists, so PostgREST can only read. Correspondence data isn't scoped
-- to a single user the way notifications are, so this uses organizations'
-- blanket "authenticated may read everything" shape, not notifications' scoped
-- "only your own rows" shape.
ALTER TABLE "correspondences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "correspondences_authenticated_read"
  ON "correspondences" FOR SELECT TO authenticated USING (true);
