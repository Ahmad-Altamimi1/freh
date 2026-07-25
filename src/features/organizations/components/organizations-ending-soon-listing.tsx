import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';
import {
  organizationFacetsQueryOptions,
  organizationTermBucketCountsQueryOptions,
  organizationsQueryOptions
} from '../api/queries';
import { organizationsEndingSoonSearchParamsCache } from '../api/search-params';
import { OrganizationsEndingSoonTable } from './organizations-ending-soon-table';

/**
 * Server half of the term-ending-soon listing — mirrors `OrganizationsListing`,
 * plus a prefetch for the "time remaining" tab counts.
 */
export default async function OrganizationsEndingSoonListing() {
  const user = await requireUser();

  const filters = {
    page: organizationsEndingSoonSearchParamsCache.get('page'),
    perPage: organizationsEndingSoonSearchParamsCache.get('perPage'),
    sort: organizationsEndingSoonSearchParamsCache.get('sort'),
    q: organizationsEndingSoonSearchParamsCache.get('q'),
    filters: organizationsEndingSoonSearchParamsCache.get('filters'),
    joinOperator: organizationsEndingSoonSearchParamsCache.get('joinOperator'),
    remainingBucket: organizationsEndingSoonSearchParamsCache.get('remaining')
  };

  const countFilters = {
    q: filters.q,
    filters: filters.filters,
    joinOperator: filters.joinOperator
  };

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(organizationsQueryOptions(filters));
  void queryClient.prefetchQuery(organizationFacetsQueryOptions());
  void queryClient.prefetchQuery(organizationTermBucketCountsQueryOptions(countFilters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationsEndingSoonTable canEdit={hasAnyRole(user, ['admin'])} />
    </HydrationBoundary>
  );
}
