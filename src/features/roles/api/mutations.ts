import { mutationOptions } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';
import { userKeys } from '@/features/users/api/queries';
import { roleKeys } from './queries';
import { createRole, deleteRole, updateRole } from './service';
import type { RoleMutationPayload } from './types';

/**
 * Every role write invalidates the users root as well as the roles root.
 *
 * The users table renders each account's role names, and its form offers the
 * assignable-roles list — both go stale the moment a role is renamed, created
 * or removed. They are separate cache roots on purpose (see `queries.ts`), so
 * the cross-invalidation has to be explicit here.
 *
 * Exported, and called directly by each component, rather than left to run only
 * from the `onSuccess` below. A caller that spreads these options and then
 * supplies its own `onSuccess` — which every one of them does, to raise a toast
 * and close its sheet — REPLACES this handler rather than adding to it, and the
 * list silently stops refreshing until the page is reloaded. Calling it by hand
 * at each site is a little more typing and cannot be lost that way.
 */
export function invalidateRoles() {
  const queryClient = getQueryClient();
  queryClient.invalidateQueries({ queryKey: roleKeys.all });
  queryClient.invalidateQueries({ queryKey: userKeys.all });
}

export const createRoleMutation = mutationOptions({
  mutationFn: (values: RoleMutationPayload) => createRole(values),
  onSuccess: invalidateRoles
});

export const updateRoleMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: RoleMutationPayload }) =>
    updateRole(id, values),
  onSuccess: invalidateRoles
});

export const deleteRoleMutation = mutationOptions({
  mutationFn: (id: string) => deleteRole(id),
  onSuccess: invalidateRoles
});
