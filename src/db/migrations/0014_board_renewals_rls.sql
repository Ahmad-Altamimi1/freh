-- Hand-written follow-up to 0013, mirroring 0010_report_templates_rls.sql's
-- role. Kept in the same folder so `db:migrate` applies it in order; if the
-- schema is ever regenerated from scratch, this file must be preserved —
-- drizzle-kit will not recreate it.

-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- The app reaches this table through `getDb()`, which connects as the owner and
-- bypasses RLS regardless — so enabling it costs the app nothing and closes the
-- direct-API hole. A renewal is directorate-wide work rather than any one
-- user's, so SELECT is granted to any authenticated user. No
-- INSERT/UPDATE/DELETE policy exists: every write goes through `getDb()` behind
-- `requirePermission()`, never through PostgREST.
ALTER TABLE "board_renewals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "board_renewals_read"
  ON "board_renewals" FOR SELECT TO authenticated USING (true);
