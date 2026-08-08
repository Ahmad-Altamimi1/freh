import { queryOptions } from '@tanstack/react-query';

import {
  getDashboardOverview,
  getOrganizationById,
  getOrganizationFacets,
  getOrganizationReport,
  getOrganizations,
  getReportTemplates,
  runOrganizationReport
} from './service';
import type { OrganizationFilters, ReportDefinition } from './types';

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
  dashboard: () => [...organizationKeys.all, 'dashboard'] as const
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

/**
 * The dashboard's own aggregate.
 *
 * Keyed under `organizationKeys.all` deliberately: every registry write
 * invalidates that root, and filling in a missing phone number must drop the
 * alert that sent the user to fill it in.
 */
export const dashboardOverviewQueryOptions = () =>
  queryOptions({
    queryKey: organizationKeys.dashboard(),
    queryFn: () => getDashboardOverview(),
    staleTime: 60 * 1000
  });

export const organizationReportQueryOptions = (filters: OrganizationFilters) =>
  queryOptions({
    queryKey: organizationKeys.report(filters),
    queryFn: () => getOrganizationReport(filters)
  });

/**
 * A report built from a full definition rather than a bare filter.
 *
 * The whole definition is the key: changing the grouping or adding the detail
 * table produces a different document from the same rows, so they must not share
 * a cache entry.
 */
export const organizationReportRunOptions = (definition: ReportDefinition) =>
  queryOptions({
    queryKey: [...organizationKeys.all, 'report-run', definition] as const,
    queryFn: () => runOrganizationReport(definition)
  });

/**
 * Saved templates get their own root key, deliberately not under
 * `organizationKeys.all`.
 *
 * Every organization write invalidates that root (see `mutations.ts`), and a
 * template is unaffected by registry edits — hanging it there would refetch the
 * template list on every row someone saves.
 */
export const reportTemplateKeys = {
  all: ['report-templates'] as const,
  list: () => [...reportTemplateKeys.all, 'list'] as const
};

export const reportTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: reportTemplateKeys.list(),
    queryFn: () => getReportTemplates(),
    staleTime: 5 * 60 * 1000
  });
