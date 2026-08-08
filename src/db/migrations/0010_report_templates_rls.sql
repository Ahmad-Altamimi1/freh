-- Hand-written follow-up to 0007, mirroring 0005_notifications_rls.sql's role.
-- Kept in the same folder so `db:migrate` applies it in order; if the schema is
-- ever regenerated from scratch, this file must be preserved — drizzle-kit will
-- not recreate it.

-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- The app reaches this table through `getDb()`, which connects as the owner and
-- bypasses RLS regardless — so enabling it costs the app nothing and closes the
-- direct-API hole. Report templates are shared across the directorate's staff
-- (see the table comment), so SELECT is granted to any authenticated user
-- rather than scoped to the author. No INSERT/UPDATE/DELETE policy exists: all
-- writes go through `getDb()` behind `requireUser()`, never through PostgREST.
ALTER TABLE "report_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "report_templates_read"
  ON "report_templates" FOR SELECT TO authenticated USING (true);
