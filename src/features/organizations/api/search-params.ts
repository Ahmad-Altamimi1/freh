import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum
} from 'nuqs/server';

import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import type { Organization } from './types';

/**
 * Every column the table can sort or filter by.
 *
 * Passing this to the parsers means a query string naming a column that does not
 * exist is rejected at parse time rather than reaching the query builder. It
 * also keeps a stale shared link from silently filtering on nothing.
 */
export const ORGANIZATION_COLUMN_IDS = [
  'name',
  'district',
  'classification',
  'nationalId',
  'establishedAt',
  'directorName',
  'mobile',
  'serialNo'
] as const;

/**
 * Rows per page.
 *
 * Exported because three separate parsers read the same `perPage` URL key — the
 * server cache here, the table's own `useQueryStates`, and `useDataTable`'s
 * internal one. Each applies its own default when the param is absent, so a
 * literal in any one of them would silently disagree with the others: the query
 * would fetch one page size while the pagination control counted by another.
 *
 * Change it here and the three parsers, the pagination control and the loading
 * skeleton all follow.
 */
export const DEFAULT_PAGE_SIZE = 10;

/** Choices offered in the rows-per-page control. Must contain the default. */
export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

/**
 * Search params for the organizations table.
 *
 * Feature-local rather than added to the shared `@/lib/searchparams`, because
 * the filter and sort parsers are validated against this feature's column ids —
 * a shared definition could not do that without knowing every feature's columns.
 * The report page reads the same definition, which is what lets a filtered table
 * hand its exact result set to a report.
 */
export const organizationsSearchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  sort: getSortingStateParser<Organization>(new Set(ORGANIZATION_COLUMN_IDS)).withDefault([
    { id: 'name', desc: false }
  ]),
  /** Quick search — matched against the normalized `search_key` column. */
  q: parseAsString.withDefault(''),
  /** Conditions built in the advanced filter panel. */
  filters: getFiltersStateParser<Organization>(new Set(ORGANIZATION_COLUMN_IDS)).withDefault([]),
  joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
};

export const organizationsSearchParamsCache = createSearchParamsCache(organizationsSearchParams);

/** Builds a URL carrying the current filter state — used for the report link. */
export const serializeOrganizationsParams = createSerializer(organizationsSearchParams);
