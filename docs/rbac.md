# Roles & Permissions

Database-backed RBAC. Roles are named bundles of permissions, editable at runtime; permissions are a closed, typed set defined in code.

> **The golden rule:** never branch on a role name. Check a permission. A role is a label an administrator can rename, retire or redefine from the UI — a permission is the capability itself.

## The shape of it

| Layer | Where | What it is |
| --- | --- | --- |
| Permission catalog | `src/lib/auth/permissions.ts` | The closed set of capabilities, their Arabic labels, and the seed role presets |
| Storage | `src/db/schema/access-control.ts` | `roles`, `role_permissions`, `user_roles` |
| Resolution + guards | `src/lib/auth/access.ts` | Turns a user into an effective permission set; `requirePermission` and friends |
| Client checks | `src/hooks/use-permissions.ts` | `usePermissions()` / `useCan()` for hiding controls |
| Role admin | `src/features/roles/` → `/dashboard/settings/roles` | Create/edit/delete roles, tick permissions |
| User admin | `src/features/users/` → `/dashboard/users` | Assign roles to accounts |

## Why the database, not `app_metadata`

Roles used to live in the Supabase user's `app_metadata`. Three reasons they moved:

- **Runtime CRUD.** `app_metadata` can hold a role *name*, but there is nowhere in it to define what a role *means*. The definition has to live somewhere queryable for "create a role and tick its permissions" to be a screen rather than a deploy.
- **Immediate effect.** `app_metadata` is baked into the JWT. A revoked permission would keep working until the token refreshed — up to an hour of access you thought you had taken away. Permissions resolved from these tables apply on the user's very next request.
- **Auditability.** `user_roles.granted_by` / `granted_at` record who granted what, when.

`app_metadata.role === 'admin'` is still honoured, but **only as a bootstrap**: it applies when a user holds no role in the database at all. Without it, deploying this system would lock the existing administrators out of the screen that assigns database roles. The moment any role is granted through the UI, the database is authoritative and the metadata is ignored.

## The catalog

```ts
import { PERMISSIONS } from '@/lib/auth/permissions';

PERMISSIONS.ORGANIZATIONS_READ;      // 'organizations:read'
PERMISSIONS.REPORTS_EXPORT_PDF;      // 'reports:export:pdf'
```

`Permission` is a union of string literals, so a typo is a compile error. `PERMISSION_GROUPS` carries the Arabic label and description for each one — the role editor renders straight from it, so **adding a permission and naming it are the same edit**. There is no second list to keep in sync.

Current domains: `organizations` (read/create/update/delete/import/export), `members`, `correspondences` (read/create/update/delete), `reports` (view + per-format export + template management), `notifications`, `access`.

### Adding a permission

1. Add the constant to `PERMISSIONS`.
2. Add its label (and ideally a description) to the matching `PERMISSION_GROUPS` entry.
3. Use it in a guard.

It appears in the role editor automatically. It is granted to nobody until an administrator ticks it — except the system role, which holds it immediately (see below).

### Retiring one

Delete it from `PERMISSIONS`. Rows left in `role_permissions` are filtered out on read by `isPermission()`, so it silently stops granting anything rather than lingering as a string no check can match.

## Seeded roles

| Key | Name | Holds |
| --- | --- | --- |
| `admin` | مدير النظام | Everything. **System role** — see below |
| `editor` | محرّر | Full CRUD on the registry and correspondences, reports and exports, no access management |
| `reporter` | مسؤول التقارير | Read-only data, plus report viewing and every export format |
| `viewer` | مطّلع | Read-only. No writes, no downloads |

These are a starting point written by `0012_access_control_rls_seed.sql`, not behaviour. An administrator can retick any of them and the app follows, because nothing checks a role name.

### The system role

`admin` is the one role with `is_system = true`, and it is special in exactly two ways:

- **Its permissions are derived, never stored.** It holds `ALL_PERMISSIONS` by definition — both in resolution and in the editor. This is why it has no `role_permissions` rows. A stored copy of the catalog would go stale the moment a permission was added, and an administrator who quietly stops being able to do something new is a bad failure.
- **It cannot be deleted or weakened.** Without one undeletable all-permissions role, an administrator can remove `access:manage` from the last role that has it and lock everyone out of the permission screen permanently, recoverable only by hand-written SQL.

The service also refuses an edit that would strip **your own** `access:manage` — unless another role you hold still grants it.

## Guarding server code

Every Server Action, Route Handler and page does its own check. `'use server'` makes each export a POST endpoint, so a hidden button guards nothing.

```ts
import { requirePermission, requirePagePermission, can, canAny } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';

// Server Actions / Route Handlers — throws ForbiddenError (Arabic message)
const user = await requirePermission(PERMISSIONS.ORGANIZATIONS_DELETE, 'غير مصرح لك بتعديل السجل.');

// Pages — redirects instead of throwing, so a stray link is not an error screen
await requirePagePermission(PERMISSIONS.REPORTS_VIEW);

// Conditionals
if (await can(PERMISSIONS.ORGANIZATIONS_EXPORT)) { … }
const canEdit = await canAny([PERMISSIONS.ORGANIZATIONS_UPDATE, PERMISSIONS.ORGANIZATIONS_DELETE]);
```

Resolution is wrapped in React `cache`, so the layout, the page and every action in one render share a single lookup.

`listUserIdsWithPermission(permission)` answers "who should be told about this" for broadcasts — used by the term-end notification cron, so a new role starts receiving alerts the moment it is granted `organizations:read`.

## Guarding the UI

```tsx
'use client';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';

const { can } = usePermissions();
{can(PERMISSIONS.ORGANIZATIONS_EXPORT) && <ExportButton />}
```

Reads the server-seeded session, so it is synchronous — no loading state, no flash of a control the user cannot use. **This is UX, not security.** Everything it hides is re-checked on the server.

Navigation uses the same idea declaratively — see [nav-rbac.md](./nav-rbac.md).

## Reports and exports

Viewing a report and taking it away as a file are separate grants, because that is the distinction that matters when data leaves the building.

| Permission | Gates |
| --- | --- |
| `reports:view` | `/dashboard/organizations/reports`, running a report on screen, reading saved templates |
| `reports:export:pdf` | `/api/organizations/report/pdf`, the `/print/organizations-report` route, **and the browser-print button** |
| `reports:export:excel` | Workbook download from the report surfaces |
| `reports:template:manage` | Creating, editing and deleting shared report templates |
| `organizations:export` | Workbook download from the registry table toolbar |
| `organizations:import` | Both import flows and the blank template downloads |

Two deliberate decisions here:

- **The print route requires the PDF permission, not the view permission.** That page *is* the PDF — the export route renders exactly that URL in headless Chromium, and Ctrl+P turns it into a file just as readily. Gating it on `reports:view` would make "can look but not download" bypassable by opening the preview and pressing print. The on-screen print button is gated the same way, for the same reason.
- **`/api/organizations/export` accepts *either* export permission.** One endpoint backs three surfaces over identical rows. Requiring `organizations:export` would break the reporter role; requiring `reports:export:excel` would break the registry toolbar; requiring both would break each for the other's sake. What either permission means is "may take these rows out as a file", which is exactly that route.

## Row Level Security

`roles`, `role_permissions` and `user_roles` have RLS **enabled with no policies at all** — stricter than `report_templates`, which grants SELECT to authenticated users.

Nothing outside the server reads them: the app reaches them through `getDb()` (owner connection, bypasses RLS) and the browser receives resolved permissions through the session, never a query. So a policy-free RLS denies every PostgREST request at zero cost to the app. It matters here more than elsewhere — together these tables are a map of who can do what, exactly the reconnaissance a leaked anon key would want.

## Assigning a role

`/dashboard/users` (requires `access:manage`) lists the Supabase Auth directory with each account's roles, and its form assigns one. Users hold roles many-to-many at the schema level and their permissions are the union, so multiple roles work if the form is ever extended.

Changing a permission takes effect on the user's next request. No sign-out required — that was the point of moving off the JWT.
