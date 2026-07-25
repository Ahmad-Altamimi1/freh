'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import * as React from 'react';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/table/data-table-advanced-toolbar';
import {
  DataTableFilterList,
  type FilterListLabels
} from '@/components/ui/table/data-table-filter-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataTable } from '@/hooks/use-data-table';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import type { ExtendedColumnFilter, JoinOperator } from '@/types/data-table';
import {
  organizationFacetsQueryOptions,
  organizationTermBucketCountsQueryOptions,
  organizationsQueryOptions
} from '../../api/queries';
import {
  DEFAULT_PAGE_SIZE,
  ORGANIZATION_COLUMN_IDS,
  PAGE_SIZE_OPTIONS
} from '../../api/search-params';
import type { Organization } from '../../api/types';
import {
  FILTER_OPERATOR_LABELS,
  JOIN_OPERATOR_LABELS,
  ORGANIZATION_LABELS,
  ORGANIZATION_TERM_BUCKET_LABELS,
  RELATIVE_DATE_LABELS
} from '../../constants/labels';
import { TERM_REMAINING_FILTER_VALUES, type TermRemainingFilter } from '../../lib/term';
import { getOrganizationColumns } from '../organizations-table/columns';

const COLUMN_ID_SET = new Set<string>(ORGANIZATION_COLUMN_IDS);
const REMAINING_VALUES = [...TERM_REMAINING_FILTER_VALUES];

const FILTER_LABELS: FilterListLabels = {
  trigger: ORGANIZATION_LABELS.filters.trigger,
  empty: ORGANIZATION_LABELS.filters.empty,
  add: ORGANIZATION_LABELS.filters.add,
  apply: ORGANIZATION_LABELS.filters.apply,
  reset: ORGANIZATION_LABELS.filters.reset,
  remove: ORGANIZATION_LABELS.filters.remove,
  where: ORGANIZATION_LABELS.filters.where,
  selectField: ORGANIZATION_LABELS.filters.selectField,
  selectOperator: ORGANIZATION_LABELS.filters.selectOperator,
  value: ORGANIZATION_LABELS.filters.value,
  from: ORGANIZATION_LABELS.filters.from,
  to: ORGANIZATION_LABELS.filters.to,
  operator: FILTER_OPERATOR_LABELS,
  join: JOIN_OPERATOR_LABELS,
  relativeDate: RELATIVE_DATE_LABELS
};

interface OrganizationsEndingSoonTableProps {
  canEdit: boolean;
}

/**
 * Same shape as `OrganizationsTable`, kept as its own component rather than a
 * flag on that one: the "time remaining" tabs need their own query-param and
 * their own count query, and this way the main listing — the page that
 * matters most day to day — stays completely untouched.
 *
 * Every default here (`sort`, `page`, `perPage`, `remaining`) must match
 * `organizationsEndingSoonSearchParams` in `api/search-params.ts` exactly —
 * the server prefetches under a query key built from those defaults, and a
 * mismatch here means the client computes a different key, never finds the
 * dehydrated cache entry, and nuqs ends up rewriting the URL mid-render.
 */
export function OrganizationsEndingSoonTable({ canEdit }: OrganizationsEndingSoonTableProps) {
  const [isPending, startTransition] = React.useTransition();

  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
      q: parseAsString.withDefault(''),
      sort: getSortingStateParser<Organization>(COLUMN_ID_SET).withDefault([
        { id: 'termEnd', desc: false }
      ]),
      filters: getFiltersStateParser<Organization>(COLUMN_ID_SET).withDefault([]),
      joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and'),
      remaining: parseAsStringEnum(REMAINING_VALUES).withDefault('all')
    },
    { shallow: true, history: 'replace', startTransition }
  );

  const { data: facets } = useSuspenseQuery(organizationFacetsQueryOptions());

  const districtOptions = React.useMemo(
    () =>
      facets.districts.map((facet) => ({
        label: facet.value,
        value: facet.value,
        count: facet.count
      })),
    [facets.districts]
  );

  const classificationOptions = React.useMemo(
    () =>
      facets.classifications.map((facet) => ({
        label: facet.value,
        value: facet.value,
        count: facet.count
      })),
    [facets.classifications]
  );

  const columns = React.useMemo(
    () =>
      getOrganizationColumns({
        districtOptions,
        classificationOptions,
        canEdit,
        includeRemainingTimeColumn: true
      }),
    [districtOptions, classificationOptions, canEdit]
  );

  // The bucket counts describe "how many fall in each bucket under the current
  // search/filter" — so they exclude the bucket selection itself and reset to
  // page 1 whenever it changes, same as any other filter.
  const countFilters = React.useMemo(
    () => ({
      q: params.q,
      filters: params.filters,
      joinOperator: params.joinOperator as JoinOperator
    }),
    [params.q, params.filters, params.joinOperator]
  );

  const { data: bucketCounts } = useSuspenseQuery(
    organizationTermBucketCountsQueryOptions(countFilters)
  );

  const filters = React.useMemo(
    () => ({
      page: params.page,
      perPage: params.perPage,
      sort: params.sort,
      q: params.q,
      filters: params.filters,
      joinOperator: params.joinOperator as JoinOperator,
      remainingBucket: params.remaining as TermRemainingFilter
    }),
    [params]
  );

  const { data } = useSuspenseQuery(organizationsQueryOptions(filters));

  const { table } = useDataTable({
    data: data.data,
    columns,
    pageCount: data.pageCount,
    enableAdvancedFilter: true,
    shallow: true,
    startTransition,
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: 'termEnd', desc: false }],
      pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
      columnPinning: { right: canEdit ? ['actions'] : [] }
    }
  });

  const [searchDraft, setSearchDraft] = React.useState(params.q);

  React.useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  // Tabs' own controlled `value` needs to update in the same tick as the
  // click, before the transitioned `setParams` (and the refetch it triggers)
  // has committed — same reasoning as `searchDraft` above.
  const [remainingDraft, setRemainingDraft] = React.useState(params.remaining);

  React.useEffect(() => {
    setRemainingDraft(params.remaining);
  }, [params.remaining]);

  const commitSearch = useDebouncedCallback((value: string) => {
    void setParams({ q: value || null, page: 1 });
  }, 350);

  const onSearchChange = React.useCallback(
    (value: string) => {
      setSearchDraft(value);
      commitSearch(value);
    },
    [commitSearch]
  );

  const onFiltersChange = React.useCallback(
    (next: ExtendedColumnFilter<Organization>[]) => {
      void setParams({ filters: next, page: 1 });
    },
    [setParams]
  );

  const onJoinOperatorChange = React.useCallback(
    (value: JoinOperator) => {
      void setParams({ joinOperator: value, page: 1 });
    },
    [setParams]
  );

  const onRemainingChange = React.useCallback(
    (value: string) => {
      setRemainingDraft(value as TermRemainingFilter);
      void setParams({ remaining: value as TermRemainingFilter, page: 1 });
    },
    [setParams]
  );

  return (
    <DataTable table={table} isPending={isPending} pageSizeOptions={PAGE_SIZE_OPTIONS}>
      <Tabs value={remainingDraft} onValueChange={onRemainingChange}>
        <TabsList className='flex-wrap'>
          {REMAINING_VALUES.map((bucket) => (
            <TabsTrigger key={bucket} value={bucket}>
              {ORGANIZATION_TERM_BUCKET_LABELS[bucket]} ({bucketCounts[bucket]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTableAdvancedToolbar
        table={table}
        search={searchDraft}
        onSearchChange={onSearchChange}
        searchPlaceholder={ORGANIZATION_LABELS.table.search}
        filterList={
          <DataTableFilterList
            table={table}
            filters={params.filters}
            onFiltersChange={onFiltersChange}
            joinOperator={params.joinOperator as JoinOperator}
            onJoinOperatorChange={onJoinOperatorChange}
            labels={FILTER_LABELS}
          />
        }
      />
    </DataTable>
  );
}
