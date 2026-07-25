-- Hand-written follow-up to 0004, mirroring 0001_organizations_indexes.sql's
-- role for the `organizations` table. Kept in the same folder so `db:migrate`
-- applies it in order; if the schema is ever regenerated from scratch, this
-- file must be preserved — drizzle-kit will not recreate it.

-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- The app itself reaches this table through `getDb()`, which connects as the
-- owner and bypasses RLS regardless — so enabling it costs the app nothing and
-- closes the direct-API hole. Unlike `organizations`' blanket "authenticated
-- may read everything" policy, every notification belongs to exactly one
-- recipient, so this scopes SELECT to the caller's own rows. No
-- INSERT/UPDATE/DELETE policy exists: all writes go through `getDb()` behind
-- `requireUser()` or the cron route's shared-secret check, never directly
-- through PostgREST.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "notifications_own_read"
  ON "notifications" FOR SELECT TO authenticated USING (recipient_id = auth.uid());
