import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';
import { correspondenceFacetsQueryOptions, correspondencesQueryOptions } from '../api/queries';
import { correspondencesSearchParamsCache } from '../api/search-params';
import { CorrespondencesTable } from './correspondences-table';

/**
 * Server half of the correspondences listing.
 *
 * Prefetches with `void` (fire-and-forget) rather than `await` so the server
 * component returns immediately and the query streams in. The client half
 * reads the identical query options, so the prefetched entry is the one it
 * hydrates.
 */
export default async function CorrespondencesListing() {
  const user = await requireUser();
  const filters = {
    page: correspondencesSearchParamsCache.get('page'),
    perPage: correspondencesSearchParamsCache.get('perPage'),
    sort: correspondencesSearchParamsCache.get('sort'),
    q: correspondencesSearchParamsCache.get('q'),
    filters: correspondencesSearchParamsCache.get('filters'),
    joinOperator: correspondencesSearchParamsCache.get('joinOperator')
  };

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(correspondencesQueryOptions(filters));
  void queryClient.prefetchQuery(correspondenceFacetsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CorrespondencesTable canEdit={hasAnyRole(user, ['admin'])} />
    </HydrationBoundary>
  );
}
