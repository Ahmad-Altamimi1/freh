'use client';

/**
 * Client-side filtering of navigation items by RBAC.
 *
 * Reads roles and permissions from the session seeded by the server (see
 * `SessionProvider`), so filtering is synchronous — no loading states, no
 * flashing of items the user cannot reach.
 *
 * This is UX only. Hiding a link is not access control: every protected page,
 * Server Action and Route Handler must still check on the server with
 * `requireUser()` plus the helpers in `@/lib/auth/roles`.
 */

import { useMemo } from 'react';
import { useOptionalSessionUser } from '@/components/layout/session-provider';
import type { NavGroup, NavItem, PermissionCheck } from '@/types';

function isAllowed(
  access: PermissionCheck | undefined,
  roles: string[],
  permissions: string[]
): boolean {
  if (!access) return true;
  if (access.anyRole?.length && !access.anyRole.some((role) => roles.includes(role))) return false;
  if (access.permissions?.some((permission) => !permissions.includes(permission))) return false;
  return true;
}

function filterItems(items: NavItem[], roles: string[], permissions: string[]): NavItem[] {
  return items
    .filter((item) => isAllowed(item.access, roles, permissions))
    .map((item) =>
      item.items?.length ? { ...item, items: filterItems(item.items, roles, permissions) } : item
    );
}

/** Filters a flat list of nav items, recursing into child items. */
export function useFilteredNavItems(items: NavItem[]): NavItem[] {
  const user = useOptionalSessionUser();
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  return useMemo(
    () => filterItems(items, roles, permissions),
    // Join to a primitive: the arrays are rebuilt each render, so comparing
    // them by reference would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, roles.join(','), permissions.join(',')]
  );
}

/** Filters nav groups, dropping any group left with no visible items. */
export function useFilteredNavGroups(groups: NavGroup[]): NavGroup[] {
  const user = useOptionalSessionUser();
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  return useMemo(
    () =>
      groups
        .map((group) => ({ ...group, items: filterItems(group.items, roles, permissions) }))
        .filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, roles.join(','), permissions.join(',')]
  );
}
