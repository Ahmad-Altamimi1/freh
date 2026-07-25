import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum
} from 'nuqs/server';

import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import { TERM_REMAINING_FILTER_VALUES } from '../lib/term';
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
  'termStart',
  'termEnd',
  'termLength',
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

/**
 * Search params for the term-ending-soon page.
 *
 * Extends the main table's bundle with one more param — the same q/filter
 * plumbing, plus which "time remaining" tab is active — rather than a separate
 * definition, so the two pages can never drift on how the shared params parse.
 *
 * `sort` is overridden rather than inherited: this page's table defaults to
 * sorting by `termEnd` (soonest first), not `name`. The client table component
 * must default its own `sort` parser to the exact same value — if the two ever
 * disagreed, the server would prefetch one query key and the client would read
 * a different one, and nuqs would detect the server/client mismatch and rewrite
 * the URL during the first client render, which is what a "Cannot update a
 * component while rendering a different component" warning turned out to be.
 */
export const organizationsEndingSoonSearchParams = {
  ...organizationsSearchParams,
  sort: getSortingStateParser<Organization>(new Set(ORGANIZATION_COLUMN_IDS)).withDefault([
    { id: 'termEnd', desc: false }
  ]),
  remaining: parseAsStringEnum([...TERM_REMAINING_FILTER_VALUES]).withDefault('all')
};

export const organizationsEndingSoonSearchParamsCache = createSearchParamsCache(
  organizationsEndingSoonSearchParams
);
