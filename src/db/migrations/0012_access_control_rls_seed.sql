-- Hand-written follow-up to 0011, mirroring 0005/0008/0010's role. Kept in the
-- same folder so `db:migrate` applies it in order; if the schema is ever
-- regenerated from scratch, this file must be preserved — drizzle-kit will not
-- recreate it.

-- ============================================================
-- Row Level Security
-- ============================================================
-- Tables created by drizzle-kit land with RLS DISABLED, which on Supabase means
-- anyone holding the publishable anon key can read the whole table directly
-- through PostgREST, bypassing this app entirely.
--
-- These three are enabled with NO policies at all, unlike `report_templates`
-- which grants SELECT to authenticated. That is deliberate: nothing outside the
-- server reads them. The app reaches them only through `getDb()`, which
-- connects as the owner and bypasses RLS, and the browser receives a user's
-- resolved permissions through the session — never a query against these
-- tables. RLS with no policy therefore denies every PostgREST request while
-- costing the app nothing.
--
-- Closing this off matters more here than elsewhere: `role_permissions` and
-- `user_roles` together are a map of who can do what, which is precisely the
-- reconnaissance an attacker holding a leaked anon key would want.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============================================================
-- Seed roles
-- ============================================================
-- A snapshot of `ROLE_PRESETS` in `@/lib/auth/permissions` as it stood at
-- install time. These rows are user-owned data from here on: an administrator
-- editing "محرّر" in the UI is expected to diverge from this file, and this
-- migration must never be re-run to "correct" that. `ON CONFLICT DO NOTHING`
-- keeps it safe against a partially-seeded database.
--
-- `admin` deliberately receives NO role_permissions rows. It is the one role
-- with `is_system = true`, and both permission resolution and the role editor
-- derive "holds everything" from that flag rather than from stored rows. Listing
-- its permissions here would create a second copy of the catalog that silently
-- goes stale the moment a new permission is added — an admin who quietly stops
-- being able to do something new is a bad failure. Deriving it cannot drift.
INSERT INTO "roles" ("key", "name", "description", "is_system") VALUES
  ('admin',    'مدير النظام',      'صلاحية كاملة على السجل والتقارير وإدارة المستخدمين.',    true),
  ('editor',   'محرّر',            'إدخال وتعديل بيانات السجل والمراسلات، دون إدارة الصلاحيات.', false),
  ('reporter', 'مسؤول التقارير',   'اطّلاع على البيانات مع صلاحية إخراج التقارير وتنزيلها.',   false),
  ('viewer',   'مطّلع',            'اطّلاع فقط: لا إضافة ولا تعديل ولا تنزيل.',              false)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p."permission"
FROM "roles" r
JOIN (VALUES
  ('editor',   'organizations:read'),
  ('editor',   'organizations:create'),
  ('editor',   'organizations:update'),
  ('editor',   'organizations:delete'),
  ('editor',   'organizations:import'),
  ('editor',   'organizations:export'),
  ('editor',   'members:update'),
  ('editor',   'correspondences:read'),
  ('editor',   'correspondences:create'),
  ('editor',   'correspondences:update'),
  ('editor',   'correspondences:delete'),
  ('editor',   'notifications:read'),
  ('editor',   'reports:view'),
  ('editor',   'reports:export:pdf'),
  ('editor',   'reports:export:excel'),
  ('editor',   'reports:template:manage'),

  ('reporter', 'organizations:read'),
  ('reporter', 'organizations:export'),
  ('reporter', 'correspondences:read'),
  ('reporter', 'notifications:read'),
  ('reporter', 'reports:view'),
  ('reporter', 'reports:export:pdf'),
  ('reporter', 'reports:export:excel'),

  ('viewer',   'organizations:read'),
  ('viewer',   'correspondences:read'),
  ('viewer',   'notifications:read')
) AS p("role_key", "permission") ON p."role_key" = r."key"
ON CONFLICT ("role_id", "permission") DO NOTHING;
