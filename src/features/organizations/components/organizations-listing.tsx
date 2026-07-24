import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';
import { organizationFacetsQueryOptions, organizationsQueryOptions } from '../api/queries';
import { organizationsSearchParamsCache } from '../api/search-params';
import { OrganizationsTable } from './organizations-table';

/**
 * Server half of the organizations listing.
 *
 * Prefetches with `void` (fire-and-forget) rather than `await` so the server
 * component returns immediately and the query streams in — the pattern the rest
 * of the template uses. The client half reads the identical query options, so
 * the prefetched entry is the one it hydrates.
 */
export default async function OrganizationsListing() {
  const user = await requireUser();
  const filters = {
    page: organizationsSearchParamsCache.get('page'),
    perPage: organizationsSearchParamsCache.get('perPage'),
    sort: organizationsSearchParamsCache.get('sort'),
    q: organizationsSearchParamsCache.get('q'),
    filters: organizationsSearchParamsCache.get('filters'),
    joinOperator: organizationsSearchParamsCache.get('joinOperator')
  };

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(organizationsQueryOptions(filters));
  void queryClient.prefetchQuery(organizationFacetsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationsTable canEdit={hasAnyRole(user, ['admin'])} />
    </HydrationBoundary>
  );
}
