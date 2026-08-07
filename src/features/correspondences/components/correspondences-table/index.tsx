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
import { useDataTable } from '@/hooks/use-data-table';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import type { ExtendedColumnFilter, JoinOperator, Option } from '@/types/data-table';
import { correspondenceFacetsQueryOptions, correspondencesQueryOptions } from '../../api/queries';
import {
  CORRESPONDENCE_COLUMN_IDS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS
} from '../../api/search-params';
import type { Correspondence } from '../../api/types';
import {
  CORRESPONDENCE_LABELS,
  FILTER_OPERATOR_LABELS,
  JOIN_OPERATOR_LABELS,
  RELATIVE_DATE_LABELS
} from '../../constants/labels';
import { getCorrespondenceColumns } from './columns';

const COLUMN_ID_SET = new Set<string>(CORRESPONDENCE_COLUMN_IDS);

/** Wiring for the shared filter builder, assembled from the feature's vocabulary. */
const FILTER_LABELS: FilterListLabels = {
  trigger: CORRESPONDENCE_LABELS.filters.trigger,
  empty: CORRESPONDENCE_LABELS.filters.empty,
  add: CORRESPONDENCE_LABELS.filters.add,
  apply: CORRESPONDENCE_LABELS.filters.apply,
  reset: CORRESPONDENCE_LABELS.filters.reset,
  remove: CORRESPONDENCE_LABELS.filters.remove,
  where: CORRESPONDENCE_LABELS.filters.where,
  selectField: CORRESPONDENCE_LABELS.filters.selectField,
  selectOperator: CORRESPONDENCE_LABELS.filters.selectOperator,
  value: CORRESPONDENCE_LABELS.filters.value,
  from: CORRESPONDENCE_LABELS.filters.from,
  to: CORRESPONDENCE_LABELS.filters.to,
  operator: FILTER_OPERATOR_LABELS,
  join: JOIN_OPERATOR_LABELS,
  relativeDate: RELATIVE_DATE_LABELS
};

interface CorrespondencesTableProps {
  /**
   * Whether the signed-in user may edit. Resolved on the server and passed
   * down, rather than read from a client-side session, so the table renders
   * the same on the server and the client and does not flash the wrong
   * controls during hydration.
   */
  canEdit: boolean;
}

export function CorrespondencesTable({ canEdit }: CorrespondencesTableProps) {
  // Every query-param write goes through this transition — see organizations'
  // own table for why `useSuspenseQuery` needs it to avoid re-triggering the
  // route's full-page Suspense fallback on every filter/sort/page change.
  const [isPending, startTransition] = React.useTransition();

  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
      q: parseAsString.withDefault(''),
      sort: getSortingStateParser<Correspondence>(COLUMN_ID_SET).withDefault([
        { id: 'createdAt', desc: true }
      ]),
      filters: getFiltersStateParser<Correspondence>(COLUMN_ID_SET).withDefault([]),
      joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
    },
    { shallow: true, history: 'replace', startTransition }
  );

  // Drives the organization filter's options. Fetched unfiltered on purpose —
  // see `correspondenceFacetsQueryOptions`.
  const { data: facets } = useSuspenseQuery(correspondenceFacetsQueryOptions());

  const organizationOptions = React.useMemo<Option[]>(
    () =>
      facets.organizations.map((facet) => ({
        label: facet.label,
        value: facet.value,
        count: facet.count
      })),
    [facets.organizations]
  );

  const columns = React.useMemo(
    () => getCorrespondenceColumns({ organizationOptions, canEdit }),
    [organizationOptions, canEdit]
  );

  const filters = React.useMemo(
    () => ({
      page: params.page,
      perPage: params.perPage,
      sort: params.sort,
      q: params.q,
      filters: params.filters,
      joinOperator: params.joinOperator as JoinOperator
    }),
    [params]
  );

  const { data } = useSuspenseQuery(correspondencesQueryOptions(filters));

  const { table } = useDataTable({
    data: data.data,
    columns,
    pageCount: data.pageCount,
    enableAdvancedFilter: true,
    shallow: true,
    startTransition,
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: 'createdAt', desc: true }],
      pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
      // TanStack's pinning sides are logical, so 'right' is the trailing edge
      // — the left one on an RTL page. See `getCommonPinningStyles`.
      columnPinning: { right: canEdit ? ['actions'] : [] }
    }
  });

  const [searchDraft, setSearchDraft] = React.useState(params.q);

  React.useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

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
    (next: ExtendedColumnFilter<Correspondence>[]) => {
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

  return (
    <DataTable table={table} isPending={isPending} pageSizeOptions={PAGE_SIZE_OPTIONS}>
      <DataTableAdvancedToolbar
        table={table}
        search={searchDraft}
        onSearchChange={onSearchChange}
        searchPlaceholder={CORRESPONDENCE_LABELS.table.search}
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
