# Navigation RBAC

Role-based filtering of sidebar and Cmd+K navigation items.

> This page covers **navigation visibility only**. For the permission catalog, role management, server guards and export gating, see [rbac.md](./rbac.md).

> **Navigation visibility is UX, not security.** Hiding a link stops nobody from typing the URL. Every protected page, Server Action and Route Handler must repeat the check on the server.

## Declaring access

Add an optional `access` property to any item in `src/config/nav-config.ts`:

```ts
{
  title: 'التقارير',
  url: '/dashboard/organizations/reports',
  icon: 'report',
  access: { permissions: ['reports:view'] }
}
```

| Rule | Meaning |
| --- | --- |
| `permissions: string[]` | User holds **every one** of these permissions |
| `anyRole: string[]` | User holds **at least one** of these roles |

Both may be combined; all declared rules must pass. Omit `access` entirely for items everyone can see. An item with `access` is hidden from signed-out users.

Child items are filtered independently, and a group left with no visible items disappears.

**Prefer `permissions` over `anyRole`.** A role name is a moving target — an administrator can rename or retire it from `/dashboard/settings/roles` — while a permission is the capability itself. `anyRole` remains supported for the rare case where the role *is* genuinely the thing you mean.

## Where the values come from

Permissions are resolved from the roles a user holds in the database (`user_roles` → `roles` → `role_permissions`), not from the JWT. `src/app/dashboard/layout.tsx` calls `getEffectiveAccess()` and seeds `SessionProvider` with the result, so `useFilteredNavGroups` filters synchronously: no loading state, no flash of items the user cannot reach, no client-side auth round-trip.

A permission change therefore lands on the user's next request — no sign-out needed.

| File | Role |
| --- | --- |
| `src/hooks/use-nav.ts` | `useFilteredNavItems` / `useFilteredNavGroups` |
| `src/components/layout/session-provider.tsx` | Server-seeded session context |
| `src/lib/auth/access.ts` | Resolves roles and permissions from the database |
| `src/lib/auth/permissions.ts` | The permission catalog |
| `src/types/index.ts` | `PermissionCheck` |

## Enforcing it for real

Filtering the nav does nothing to protect the page. Guard the route itself:

```ts
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default async function ReportsPage() {
  await requirePagePermission(PERMISSIONS.REPORTS_VIEW);
  // …
}
```

See [rbac.md](./rbac.md) for `requirePermission`, `can`, `canAny` and the rest.
