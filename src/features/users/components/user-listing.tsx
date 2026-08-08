import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { assignableRolesQueryOptions, usersQueryOptions } from '../api/queries';
import { UsersTable } from './users-table';

export default function UserListingPage() {
  const page = searchParamsCache.get('page');
  const search = searchParamsCache.get('name');
  const pageLimit = searchParamsCache.get('perPage');
  const roles = searchParamsCache.get('role');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(search && { search }),
    ...(roles && { roles }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(usersQueryOptions(filters));
  // The role list drives the table's filter options, so it has to be in the
  // dehydrated cache too — the table suspends on both.
  void queryClient.prefetchQuery(assignableRolesQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersTable />
    </HydrationBoundary>
  );
}
