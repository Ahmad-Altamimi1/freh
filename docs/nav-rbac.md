# Navigation RBAC

Role-based filtering of sidebar and Cmd+K navigation items.

> **Navigation visibility is UX, not security.** Hiding a link stops nobody from typing the URL. Every protected page, Server Action and Route Handler must repeat the check on the server.

## Declaring access

Add an optional `access` property to any item in `src/config/nav-config.ts`:

```ts
{
  title: 'Reports',
  url: '/dashboard/reports',
  icon: 'chart',
  access: { anyRole: ['admin', 'manager'] }
}
```

| Rule | Meaning |
| --- | --- |
| `anyRole: string[]` | User holds **at least one** of these roles |
| `permissions: string[]` | User holds **every one** of these permissions |

Both may be combined; all declared rules must pass. Omit `access` entirely for items everyone can see. An item with `access` is hidden from signed-out users.

Child items are filtered independently, and a group left with no visible items disappears.

## Where roles come from

Roles and permissions live in the Supabase user's `app_metadata`:

```json
{ "role": "admin", "permissions": ["reports:read"] }
```

`role` accepts a string or an array; `roles` is also read, and the two are merged.

`app_metadata` is only writable with the service role key, which is what makes it safe to base authorization on. `user_metadata` is writable by the user's own session — display only, never authorization.

Set it in the Supabase dashboard (Authentication → Users → ⋯ → Edit) or from trusted server code:

```ts
import { createAdminClient } from '@/lib/supabase/admin';

await createAdminClient().auth.admin.updateUserById(userId, {
  app_metadata: { role: 'admin' }
});
```

A user must sign out and back in — or have their token refreshed — before a metadata change reaches their session.

## How it works

`src/app/dashboard/layout.tsx` resolves the user server-side and seeds `SessionProvider`. `useFilteredNavGroups` reads roles from that context, so filtering is synchronous: no loading state, no flash of items the user cannot reach, no client-side auth round-trip.

| File | Role |
| --- | --- |
| `src/hooks/use-nav.ts` | `useFilteredNavItems` / `useFilteredNavGroups` |
| `src/components/layout/session-provider.tsx` | Server-seeded session context |
| `src/lib/auth/roles.ts` | Reads `app_metadata` |
| `src/types/index.ts` | `PermissionCheck` |

## Enforcing it for real

Filtering the nav does nothing to protect the page. Guard the route itself:

```ts
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { hasAnyRole } from '@/lib/auth/roles';

export default async function ReportsPage() {
  const user = await requireUser();
  if (!hasAnyRole(user, ['admin', 'manager'])) redirect('/dashboard/overview');
  // …
}
```

`src/lib/auth/roles.ts` also exports `hasRole`, `hasPermission`, `getUserRoles`, `getUserPermissions` and `satisfiesAccess` for use in Server Actions and Route Handlers.
