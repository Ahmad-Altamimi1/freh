import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { canAny } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
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
      {/* Whether the row-actions column exists at all. Which items it offers
          is decided per permission inside the cell — see `cell-action.tsx`. */}
      <OrganizationsTable
        canEdit={await canAny([PERMISSIONS.ORGANIZATIONS_UPDATE, PERMISSIONS.ORGANIZATIONS_DELETE])}
      />
    </HydrationBoundary>
  );
}
