'use client';

import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/table/data-table-advanced-toolbar';
import { DataTableFilterList } from '@/components/ui/table/data-table-filter-list';
import { useDataTable } from '@/hooks/use-data-table';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import type { ExtendedColumnFilter, JoinOperator, Option } from '@/types/data-table';
import { organizationFacetsQueryOptions, organizationsQueryOptions } from '../../api/queries';
import {
  DEFAULT_PAGE_SIZE,
  ORGANIZATION_COLUMN_IDS,
  PAGE_SIZE_OPTIONS
} from '../../api/search-params';
import type { Organization } from '../../api/types';
import { ORGANIZATION_FILTER_LABELS } from '../../constants/filter-labels';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../../constants/labels';
import { readFacetValues, writeFacetValues, type FacetColumn } from '../../lib/facet-conditions';
import { ReportFacetFilter } from '../report-facet-filter';
import { getOrganizationColumns } from './columns';

const COLUMN_ID_SET = new Set<string>(ORGANIZATION_COLUMN_IDS);

interface OrganizationsTableProps {
  /**
   * Whether the signed-in user may edit. Resolved on the server and passed
   * down, rather than read from a client-side session, so the table renders the
   * same on the server and the client and does not flash the wrong controls
   * during hydration.
   */
  canEdit: boolean;
}

export function OrganizationsTable({ canEdit }: OrganizationsTableProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
      q: parseAsString.withDefault(''),
      sort: getSortingStateParser<Organization>(COLUMN_ID_SET).withDefault([
        { id: 'name', desc: false }
      ]),
      filters: getFiltersStateParser<Organization>(COLUMN_ID_SET).withDefault([]),
      joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
    },
    { shallow: true, history: 'replace' }
  );

  // Facets drive the option lists for the district and classification filters.
  // Fetched unfiltered on purpose — see `organizationFacetsQueryOptions`.
  const { data: facets } = useSuspenseQuery(organizationFacetsQueryOptions());

  const districtOptions = React.useMemo<Option[]>(
    () =>
      facets.districts.map((facet) => ({
        label: facet.value,
        value: facet.value,
        count: facet.count
      })),
    [facets.districts]
  );

  const classificationOptions = React.useMemo<Option[]>(
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
        canEdit
      }),
    [districtOptions, classificationOptions, canEdit]
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

  const { data, isFetching } = useQuery({
    ...organizationsQueryOptions(filters),
    placeholderData: keepPreviousData
  });

  const rows = data?.data ?? [];
  const pageCount = data?.pageCount ?? 0;

  const { table } = useDataTable({
    data: rows,
    columns,
    pageCount,
    enableAdvancedFilter: true,
    shallow: true,
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: 'name', desc: false }],
      pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
      columnPinning: { right: canEdit ? ['actions'] : [] }
    }
  });

  // Typing narrows the result set, so the current page number stops being
  // meaningful — reset to the first page along with the term.
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

  // A facet pick narrows the result set, so the current page number stops being
  // meaningful — reset to the first page along with the condition.
  const onFacetChange = React.useCallback(
    (columnId: FacetColumn, values: string[]) => {
      void setParams({ filters: writeFacetValues(params.filters, columnId, values), page: 1 });
    },
    [params.filters, setParams]
  );

  // Carry the exact filter state to the report and the export, so both describe
  // the same rows the table is showing.
  const currentQueryString = React.useMemo(() => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.filters.length > 0) search.set('filters', JSON.stringify(params.filters));
    if (params.joinOperator !== 'and') search.set('joinOperator', params.joinOperator);
    if (params.sort.length > 0) search.set('sort', JSON.stringify(params.sort));
    const value = search.toString();
    return value ? `?${value}` : '';
  }, [params.q, params.filters, params.joinOperator, params.sort]);

  const handleRowClick = React.useCallback(
    (row: Organization) => router.push(`/dashboard/organizations/${row.id}`),
    [router]
  );

  return (
    <DataTable
      table={table}
      isPending={isFetching}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onRowClick={handleRowClick}
    >
      <DataTableAdvancedToolbar
        table={table}
        search={searchDraft}
        onSearchChange={onSearchChange}
        searchPlaceholder={ORGANIZATION_LABELS.table.search}
        /* Rendered after the builder's trigger. The two columns anyone actually
           filters by get a one-click picker over their real values, rather than
           being reachable only through three controls in the builder. */
        children={
          <>
            <ReportFacetFilter
              label={ORGANIZATION_FIELD_LABELS.district}
              options={districtOptions}
              selected={readFacetValues(params.filters, 'district')}
              onChange={(values) => onFacetChange('district', values)}
            />
            <ReportFacetFilter
              label={ORGANIZATION_FIELD_LABELS.classification}
              options={classificationOptions}
              selected={readFacetValues(params.filters, 'classification')}
              onChange={(values) => onFacetChange('classification', values)}
            />
          </>
        }
        filterList={
          <DataTableFilterList
            table={table}
            filters={params.filters}
            onFiltersChange={onFiltersChange}
            joinOperator={params.joinOperator as JoinOperator}
            onJoinOperatorChange={onJoinOperatorChange}
            labels={ORGANIZATION_FILTER_LABELS}
          />
        }
        actions={
          <>
            <Button
              variant='outline'
              size='sm'
              render={
                <Link
                  href={`/dashboard/organizations/reports${currentQueryString}`}
                  aria-label={ORGANIZATION_LABELS.actions.report}
                />
              }
            >
              <Icons.report />
              <span className='hidden sm:inline'>{ORGANIZATION_LABELS.actions.report}</span>
            </Button>
            {can(PERMISSIONS.ORGANIZATIONS_EXPORT) && (
              <Button
                variant='outline'
                size='sm'
                render={
                  <a
                    href={`/api/organizations/export${currentQueryString}`}
                    aria-label={ORGANIZATION_LABELS.actions.exportExcel}
                  />
                }
              >
                <Icons.download />
                <span className='hidden sm:inline'>{ORGANIZATION_LABELS.actions.exportExcel}</span>
              </Button>
            )}
          </>
        }
      />
    </DataTable>
  );
}
