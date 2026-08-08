'use client';

import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import type { ExtendedColumnFilter, JoinOperator, Option } from '@/types/data-table';
import {
  describeFilterChips,
  describeFilters,
  type FilterDescription
} from '../api/describe-filters';
import { organizationFacetsQueryOptions, organizationReportRunOptions } from '../api/queries';
import { ORGANIZATION_COLUMN_IDS } from '../api/search-params';
import type { Organization, ReportDefinition } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';
import { DEFAULT_REPORT_DEFINITION, encodeReportDefinition } from '../lib/report-definition';
import { OrganizationsReport } from './organizations-report';
import { ReportBuilder } from './report-builder';
import { ReportCriteriaBar } from './report-criteria-bar';
import { ReportTemplatesCard } from './report-templates';
import { getOrganizationColumns } from './organizations-table/columns';

const BUILDER = ORGANIZATION_LABELS.builder;
const COLUMN_ID_SET = new Set<string>(ORGANIZATION_COLUMN_IDS);

/**
 * The filter builder needs column definitions, not rows. A stable empty array
 * keeps the headless table from rebuilding its row model every render.
 */
const NO_ROWS: Organization[] = [];

/**
 * Owns everything the report page is made of.
 *
 * Two pieces of state, deliberately kept in different places:
 *
 *   - *Which rows* — the filter — lives in the URL, because that is what makes a
 *     report shareable, restorable, and reachable from the listing's "report on
 *     these rows" link. It arrives here already parsed by the same parsers the
 *     table uses, so a link built on one screen is valid on the other.
 *   - *What shape* — the definition — lives in React, because it is a draft
 *     until it is printed or saved as a template, and putting a half-finished
 *     column selection in the address bar would make the back button undo
 *     checkbox clicks.
 *
 * The page became a client component when the filter moved onto it: editing
 * criteria in place means the criteria are client state, and a server component
 * cannot re-render from a `shallow: true` URL write.
 */
interface ReportWorkspaceProps {
  /**
   * Rendered on the server so the printed header and the export link agree on
   * the moment the report describes.
   */
  generatedAt: string;
}

export function ReportWorkspace({ generatedAt }: ReportWorkspaceProps) {
  const { can } = usePermissions();
  const canExportPdf = can(PERMISSIONS.REPORTS_EXPORT_PDF);
  const canExportExcel = can(PERMISSIONS.REPORTS_EXPORT_EXCEL);

  /**
   * Every URL write goes through this transition, for the same reason the table
   * needs one: the report below runs on `useSuspenseQuery`, and a plain update
   * would tear the rendered report down to its Suspense fallback on every
   * keystroke. Inside a transition the previous report stays on screen and
   * `isPending` drives a much quieter loading state.
   */
  const [isPending, startTransition] = React.useTransition();

  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(''),
      filters: getFiltersStateParser<Organization>(COLUMN_ID_SET).withDefault([]),
      joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and'),
      sort: getSortingStateParser<Organization>(COLUMN_ID_SET).withDefault([
        { id: 'name', desc: false }
      ])
    },
    { shallow: true, history: 'replace', startTransition }
  );

  /**
   * Deliberately without page/perPage: a report describes the whole result set,
   * so paging is not part of its identity and must not split the cache key. The
   * shape and key order match what the server prefetched, so the first render
   * hydrates rather than refetching.
   */
  const criteria = React.useMemo<ReportDefinition['criteria']>(
    () => ({
      q: params.q,
      filters: params.filters,
      joinOperator: params.joinOperator as JoinOperator,
      sort: params.sort
    }),
    [params]
  );

  const queryString = React.useMemo(() => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.filters.length > 0) search.set('filters', JSON.stringify(params.filters));
    if (params.joinOperator !== 'and') search.set('joinOperator', params.joinOperator);
    if (params.sort.length > 0) search.set('sort', JSON.stringify(params.sort));
    const value = search.toString();
    return value ? `?${value}` : '';
  }, [params.q, params.filters, params.joinOperator, params.sort]);

  const [definition, setDefinition] = React.useState<ReportDefinition>(() => ({
    ...DEFAULT_REPORT_DEFINITION,
    criteria
  }));

  // The criteria are not the builder's to own, but they are part of the
  // definition it exports — so they are folded back in whenever they change.
  React.useEffect(() => {
    setDefinition((current) => ({ ...current, criteria }));
  }, [criteria]);

  /* ------------------------------ filter wiring ----------------------------- */

  // Facets are fetched unfiltered on purpose, so selecting one district does not
  // remove every other district from the list that offered it.
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
        canEdit: false
      }),
    [districtOptions, classificationOptions]
  );

  /**
   * A headless table, used purely as the description of what is filterable.
   *
   * `DataTableFilterList` reads operators, value variants and option lists off
   * the column definitions, so reusing the listing's columns is exactly what
   * guarantees the two screens offer the same filter. There are no rows to
   * render here — the report is the output, not a grid.
   */
  const filterTable = useReactTable({
    data: NO_ROWS,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const [searchDraft, setSearchDraft] = React.useState(params.q);

  React.useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const commitSearch = useDebouncedCallback((value: string) => {
    void setParams({ q: value || null });
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
      void setParams({ filters: next });
    },
    [setParams]
  );

  const onJoinOperatorChange = React.useCallback(
    (value: JoinOperator) => {
      void setParams({ joinOperator: value });
    },
    [setParams]
  );

  const onRemoveChip = React.useCallback(
    (id: string) => {
      if (id === 'q') {
        // Re-arming the debounce with an empty term is what neutralises it: a
        // keystroke still in flight would otherwise land after the pill was
        // removed and put the search straight back. The rescheduled call writes
        // `null` again, which is a no-op.
        setSearchDraft('');
        commitSearch('');
        void setParams({ q: null });
        return;
      }

      void setParams({
        filters: params.filters.filter((filter) => filter.filterId !== id)
      });
    },
    [commitSearch, params.filters, setParams]
  );

  const onClearAll = React.useCallback(() => {
    setSearchDraft('');
    commitSearch('');
    void setParams({ q: null, filters: null, joinOperator: null });
  }, [commitSearch, setParams]);

  const chips = React.useMemo(() => describeFilterChips(criteria), [criteria]);

  /* ------------------------------- live count ------------------------------- */

  /**
   * The count and the distribution deliberately run with no sections selected.
   *
   * `grouped` and `summary` are computed regardless, while `charts` and `table`
   * are what cost a full unpaginated row fetch — pinning sections to empty means
   * toggling "جدول التفاصيل" does not refetch thousands of rows just to redraw a
   * number that did not change.
   */
  const previewDefinition = React.useMemo<ReportDefinition>(
    () => ({ ...definition, sections: [], columns: [] }),
    [definition]
  );

  const { data: preview, isFetching } = useQuery({
    ...organizationReportRunOptions(previewDefinition),
    placeholderData: keepPreviousData
  });

  const encoded = React.useMemo(() => encodeReportDefinition(definition), [definition]);
  const isValid = definition.sections.length > 0 && definition.columns.length > 0;

  return (
    <div className='flex flex-col gap-4'>
      <ReportCriteriaBar
        table={filterTable}
        search={searchDraft}
        onSearchChange={onSearchChange}
        filters={params.filters}
        onFiltersChange={onFiltersChange}
        joinOperator={params.joinOperator as JoinOperator}
        onJoinOperatorChange={onJoinOperatorChange}
        chips={chips}
        onRemoveChip={onRemoveChip}
        onClearAll={onClearAll}
        total={preview?.summary.total}
        isFetching={isFetching || isPending}
        actions={
          <Button
            variant='outline'
            size='sm'
            nativeButton={false}
            render={
              <Link
                href={`/dashboard/organizations${queryString}`}
                aria-label={ORGANIZATION_LABELS.actions.backToList}
              />
            }
          >
            <Icons.chevronLeft className='rtl:rotate-180' />
            <span className='hidden sm:inline'>{ORGANIZATION_LABELS.actions.backToList}</span>
          </Button>
        }
      />

      {/* Restores what the old applied-filters card did for a browser print.
          On screen the pills above already say what is filtered, but a printed
          page outlives the URL that produced it — without this, a sheet reading
          "١٦ جمعية" is indistinguishable from a claim about the whole registry. */}
      <AppliedFiltersForPrint applied={describeFilters(criteria)} generatedAt={generatedAt} />

      <div className='grid items-start gap-4 print:hidden lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <ReportBuilder definition={definition} onDefinitionChange={setDefinition} />

        <div className='flex flex-col gap-4'>
          <DistributionCard
            dimension={ORGANIZATION_LABELS.groupBy[definition.groupBy]}
            grouped={preview?.grouped ?? []}
            isFetching={isFetching}
          />

          <ReportTemplatesCard definition={definition} isValid={isValid} onLoad={setDefinition} />

          {(canExportPdf || canExportExcel) && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>{BUILDER.output}</CardTitle>
                {!isValid && <CardDescription>{BUILDER.outputBlocked}</CardDescription>}
              </CardHeader>
              <CardContent className='flex flex-col gap-2'>
                {/*
                  `nativeButton={false}` tells Base UI these render as anchors,
                  not buttons — without it the Button asserts native button
                  semantics it does not have.

                  The href is dropped rather than only setting `disabled`: an
                  anchor cannot be disabled, so a bare `disabled` would grey the
                  control while leaving the link fully clickable. An <a> with no
                  href is not a link at all, which is the behaviour wanted.
                */}
                {/* Print and PDF share one permission: the print route IS the
                    document the PDF is rendered from, so allowing one while
                    hiding the other would be theatre. */}
                {canExportPdf && (
                  <>
                    <Button
                      nativeButton={false}
                      render={
                        <a
                          href={isValid ? `/print/organizations-report?d=${encoded}` : undefined}
                          target='_blank'
                          rel='noreferrer'
                          aria-label={BUILDER.openPrint}
                        />
                      }
                      disabled={!isValid}
                      variant='outline'
                    >
                      <Icons.printer className='size-4' />
                      {BUILDER.openPrint}
                    </Button>
                    <Button
                      nativeButton={false}
                      render={
                        <a
                          href={isValid ? `/api/organizations/report/pdf?d=${encoded}` : undefined}
                          aria-label={BUILDER.downloadPdf}
                        />
                      }
                      disabled={!isValid}
                    >
                      <Icons.download className='size-4' />
                      {BUILDER.downloadPdf}
                    </Button>
                    {/* Browser print is gated with the PDF permission, not
                        merely with "can see this page": Ctrl+P → Save as PDF
                        produces the same file the export route does, so leaving
                        it open would make the distinction between viewing a
                        report and taking one away purely decorative. */}
                    <Button variant='outline' onClick={() => window.print()}>
                      <Icons.printer className='size-4' />
                      {ORGANIZATION_LABELS.actions.print}
                    </Button>
                  </>
                )}
                {canExportExcel && (
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        href={`/api/organizations/export${queryString}`}
                        aria-label={BUILDER.exportExcel}
                      />
                    }
                    variant='outline'
                  >
                    <Icons.download className='size-4' />
                    {BUILDER.exportExcel}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dimmed rather than replaced while a new filter resolves: the numbers on
          screen are still the previous answer, and swapping them for skeletons
          on every keystroke is more disruptive than letting them fade. */}
      <div
        className={cn('transition-opacity', isPending && 'pointer-events-none opacity-60')}
        aria-busy={isPending}
      >
        <React.Suspense fallback={<ReportSkeleton />}>
          <OrganizationsReport filters={criteria} />
        </React.Suspense>
      </div>
    </div>
  );
}

/** The criteria block, printed only — the pills replace it on screen. */
function AppliedFiltersForPrint({
  applied,
  generatedAt
}: {
  applied: FilterDescription[];
  generatedAt: string;
}) {
  return (
    <Card className='hidden break-inside-avoid print:block'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>{ORGANIZATION_LABELS.report.appliedFilters}</CardTitle>
        <CardDescription>
          {ORGANIZATION_LABELS.report.generatedAt}: {formatDateAr(generatedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {applied.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{ORGANIZATION_LABELS.report.noFilters}</p>
        ) : (
          <ul className='flex flex-col gap-1 text-sm'>
            {applied.map((line, index) => (
              <li key={`${line.label}-${index}`} className='flex flex-wrap gap-x-2'>
                <span className='text-muted-foreground'>{line.label}</span>
                <span className='font-medium'>{line.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The grouped breakdown, as proportional bars.
 *
 * The same six numbers as a bare list force the reader to compare digit strings;
 * a bar scaled to the largest bucket answers "which is biggest, and by how much"
 * without any arithmetic. It is a preview of the grouping the printed document
 * will use, which is why it follows `definition.groupBy` rather than a fixed
 * dimension.
 */
function DistributionCard({
  dimension,
  grouped,
  isFetching
}: {
  dimension: string;
  grouped: { label: string; count: number }[];
  isFetching: boolean;
}) {
  const rows = grouped.slice(0, 6);
  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{BUILDER.distribution}</CardTitle>
        <CardDescription>{dimension}</CardDescription>
      </CardHeader>
      <CardContent aria-busy={isFetching}>
        {rows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{ORGANIZATION_LABELS.table.noResults}</p>
        ) : (
          <ul className='flex flex-col gap-2.5'>
            {rows.map((row) => (
              <li key={row.label} className='flex flex-col gap-1'>
                <div className='flex items-baseline justify-between gap-2 text-sm'>
                  <span className='min-w-0 truncate'>{row.label}</span>
                  <span dir='ltr' className='text-muted-foreground shrink-0 tabular-nums'>
                    {formatNumberAr(row.count)}
                  </span>
                </div>
                <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
                  <div
                    className='bg-primary h-full rounded-full transition-[width] duration-300'
                    style={{
                      width: max > 0 ? `${(row.count / max) * 100}%` : '0%'
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-24 w-full' />
        ))}
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Skeleton className='h-80 w-full' />
        <Skeleton className='h-80 w-full' />
      </div>
    </div>
  );
}
