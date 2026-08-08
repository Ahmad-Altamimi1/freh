import { queryOptions } from '@tanstack/react-query';
import { getAssignableRoles, getUsers } from './service';
import type { User, UserFilters } from './types';

export type { User };

export const userKeys = {
  all: ['users'] as const,
  list: (filters: UserFilters) => [...userKeys.all, 'list', filters] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  /** Assignable roles — shared by the table's role filter and the form select. */
  roles: () => [...userKeys.all, 'roles'] as const
};

export const usersQueryOptions = (filters: UserFilters) =>
  queryOptions({
    queryKey: userKeys.list(filters),
    queryFn: () => getUsers(filters)
  });

export const assignableRolesQueryOptions = () =>
  queryOptions({
    queryKey: userKeys.roles(),
    queryFn: () => getAssignableRoles(),
    // Roles change only when someone edits them on the access-control screens,
    // which is rare next to how often this list is read.
    staleTime: 5 * 60 * 1000
  });
