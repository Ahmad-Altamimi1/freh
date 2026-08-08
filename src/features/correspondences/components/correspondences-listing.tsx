import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { canAny } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
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
      {/* Whether the row-actions column exists at all. Which items it offers
          is decided per permission inside the cell — see `cell-action.tsx`. */}
      <CorrespondencesTable
        canEdit={await canAny([
          PERMISSIONS.CORRESPONDENCES_UPDATE,
          PERMISSIONS.CORRESPONDENCES_DELETE
        ])}
      />
    </HydrationBoundary>
  );
}
