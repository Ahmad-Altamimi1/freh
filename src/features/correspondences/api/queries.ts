import { queryOptions } from '@tanstack/react-query';

import { organizationsQueryOptions } from '@/features/organizations/api/queries';
import type { OrganizationFilters } from '@/features/organizations/api/types';
import {
  getCorrespondenceById,
  getCorrespondenceFacets,
  getCorrespondences,
  getCorrespondencesByOrganization
} from './service';
import type { CorrespondenceFilters } from './types';

/**
 * Query key factory.
 *
 * The whole filter object is part of the list key, so two different filter
 * states are two different cache entries and paging back to a previous filter
 * is instant rather than a refetch.
 */
export const correspondenceKeys = {
  all: ['correspondences'] as const,
  lists: () => [...correspondenceKeys.all, 'list'] as const,
  list: (filters: CorrespondenceFilters) => [...correspondenceKeys.lists(), filters] as const,
  detail: (id: string) => [...correspondenceKeys.all, 'detail', id] as const,
  facets: () => [...correspondenceKeys.all, 'facets'] as const
};

export const correspondencesQueryOptions = (filters: CorrespondenceFilters) =>
  queryOptions({
    queryKey: correspondenceKeys.list(filters),
    queryFn: () => getCorrespondences(filters)
  });

export const correspondenceByIdOptions = (id: string) =>
  queryOptions({
    queryKey: correspondenceKeys.detail(id),
    queryFn: () => getCorrespondenceById(id)
  });

export const correspondencesByOrganizationOptions = (organizationId: string) =>
  queryOptions({
    queryKey: [...correspondenceKeys.all, 'byOrganization', organizationId] as const,
    queryFn: () => getCorrespondencesByOrganization(organizationId)
  });

/**
 * Facet options are unfiltered — see `getCorrespondenceFacets`. Not scoped by
 * the current table filter, since the point is to offer every organization
 * that appears in the log regardless of what else is filtered right now.
 */
export const correspondenceFacetsQueryOptions = () =>
  queryOptions({
    queryKey: correspondenceKeys.facets(),
    queryFn: () => getCorrespondenceFacets(),
    staleTime: 5 * 60 * 1000
  });

/**
 * Full organization list for the create/edit form's combobox.
 *
 * Delegates to the organizations feature's own already-cached query rather
 * than adding new query surface here — correspondences doesn't own that
 * table. `perPage` caps at 200; organizations currently number ~137,
 * comfortably under that. If that count grows past it, this needs real
 * server-side search instead of the combobox's client-side filtering.
 */
const ORGANIZATION_OPTIONS_FILTERS: OrganizationFilters = {
  page: 1,
  perPage: 200,
  sort: [{ id: 'name', desc: false }],
  q: '',
  filters: [],
  joinOperator: 'and'
};

export const correspondenceOrganizationOptionsQueryOptions = () =>
  organizationsQueryOptions(ORGANIZATION_OPTIONS_FILTERS);
