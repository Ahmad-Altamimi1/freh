'use client';

import { useCallback } from 'react';
import { useOptionalSessionUser } from '@/components/layout/session-provider';
import type { Permission } from '@/lib/auth/permissions';

/**
 * Permission checks for Client Components.
 *
 * Reads the session seeded by the server in `SessionProvider`, so checks are
 * synchronous — no loading state, no flash of a button the user cannot press.
 *
 * This is UX only. Everything it gates is re-checked on the server with
 * `@/lib/auth/access`; disabling a control here stops an honest mistake, not an
 * attacker.
 */
export function usePermissions() {
  const user = useOptionalSessionUser();
  const permissions = user?.permissions ?? [];
  const key = permissions.join(',');

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    // Join to a primitive: the array is rebuilt each render, so comparing it by
    // reference would rebuild the callback every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  const canAny = useCallback(
    (list: Permission[]) => list.some((permission) => permissions.includes(permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  const canAll = useCallback(
    (list: Permission[]) => list.every((permission) => permissions.includes(permission)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return { can, canAny, canAll, permissions };
}

/** Single-permission convenience: `const canEdit = useCan(PERMISSIONS.X)`. */
export function useCan(permission: Permission): boolean {
  return usePermissions().can(permission);
}
