import { queryOptions } from '@tanstack/react-query';

import { getRoles } from './service';

/**
 * Query key factory.
 *
 * Roles hang off their own root, deliberately not under the users feature's:
 * assigning a user a role changes `userKeys`, editing what a role *means*
 * changes this one, and conflating them would refetch the whole auth directory
 * every time a checkbox moved.
 */
export const roleKeys = {
  all: ['roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const
};

export const rolesQueryOptions = () =>
  queryOptions({
    queryKey: roleKeys.list(),
    queryFn: () => getRoles()
  });
