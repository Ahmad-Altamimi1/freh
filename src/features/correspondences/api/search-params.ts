import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum
} from 'nuqs/server';

import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import type { Correspondence } from './types';

/**
 * Every column the table can sort or filter by. A query string naming a
 * column that does not exist is rejected at parse time rather than reaching
 * the query builder.
 */
export const CORRESPONDENCE_COLUMN_IDS = ['name', 'type', 'organizationId', 'createdAt'] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

/**
 * Search params for the correspondences table.
 *
 * Feature-local rather than the shared `@/lib/searchparams`, because the
 * filter and sort parsers are validated against this feature's own column
 * ids.
 */
export const correspondencesSearchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  sort: getSortingStateParser<Correspondence>(new Set(CORRESPONDENCE_COLUMN_IDS)).withDefault([
    { id: 'createdAt', desc: true }
  ]),
  /** Quick search — matched against the normalized `search_key` column. */
  q: parseAsString.withDefault(''),
  /** Conditions built in the advanced filter panel. */
  filters: getFiltersStateParser<Correspondence>(new Set(CORRESPONDENCE_COLUMN_IDS)).withDefault(
    []
  ),
  joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
};

export const correspondencesSearchParamsCache = createSearchParamsCache(
  correspondencesSearchParams
);

/** Builds a URL carrying the current filter state. */
export const serializeCorrespondencesParams = createSerializer(correspondencesSearchParams);
