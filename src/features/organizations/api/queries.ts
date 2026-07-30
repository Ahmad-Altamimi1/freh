import { queryOptions } from '@tanstack/react-query';

import {
  getOrganizationById,
  getOrganizationFacets,
  getOrganizationReport,
  getOrganizations,
  getOrganizationTermBucketCounts
} from './service';
import type { OrganizationFilters } from './types';

/**
 * Query key factory.
 *
 * The whole filter object is part of the list key, so two different filter
 * states are two different cache entries and paging back to a previous filter is
 * instant rather than a refetch.
 */
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (filters: OrganizationFilters) => [...organizationKeys.lists(), filters] as const,
  detail: (id: string) => [...organizationKeys.all, 'detail', id] as const,
  facets: (filters: OrganizationFilters) => [...organizationKeys.all, 'facets', filters] as const,
  report: (filters: OrganizationFilters) => [...organizationKeys.all, 'report', filters] as const,
  termBucketCounts: (filters: OrganizationFilters) =>
    [...organizationKeys.all, 'term-bucket-counts', filters] as const
};

export const organizationsQueryOptions = (filters: OrganizationFilters) =>
  queryOptions({
    queryKey: organizationKeys.list(filters),
    queryFn: () => getOrganizations(filters)
  });

export const organizationByIdOptions = (id: string) =>
  queryOptions({
    queryKey: organizationKeys.detail(id),
    queryFn: () => getOrganizationById(id)
  });

/**
 * Facet options are deliberately keyed on an empty filter: the dropdown should
 * offer every district that exists, not only those surviving the current
 * filter — otherwise selecting one district removes all the others from the
 * list that produced it.
 */
export const organizationFacetsQueryOptions = () =>
  queryOptions({
    queryKey: organizationKeys.facets({}),
    queryFn: () => getOrganizationFacets({}),
    staleTime: 5 * 60 * 1000
  });

export const organizationReportQueryOptions = (filters: OrganizationFilters) =>
  queryOptions({
    queryKey: organizationKeys.report(filters),
    queryFn: () => getOrganizationReport(filters)
  });

/** Backs the time-remaining tabs on the term-ending-soon page. */
export const organizationTermBucketCountsQueryOptions = (filters: OrganizationFilters) =>
  queryOptions({
    queryKey: organizationKeys.termBucketCounts(filters),
    queryFn: () => getOrganizationTermBucketCounts(filters)
  });
