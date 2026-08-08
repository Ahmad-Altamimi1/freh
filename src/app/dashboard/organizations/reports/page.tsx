import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import {
  organizationFacetsQueryOptions,
  organizationReportRunOptions,
  reportTemplatesQueryOptions
} from '@/features/organizations/api/queries';
import { organizationsSearchParamsCache } from '@/features/organizations/api/search-params';
import { ReportWorkspace } from '@/features/organizations/components/report-workspace';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'تقارير الجمعيات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  // Seeing a report on screen and taking it away as a file are separate
  // grants; this is the weaker of the two. The workspace hides each download
  // control on its own permission, and every download route re-checks.
  await requirePagePermission(PERMISSIONS.REPORTS_VIEW);

  const searchParams = await props.searchParams;
  organizationsSearchParamsCache.parse(searchParams);

  /*
   * Prefetched from the URL only — the criteria are the workspace's from here
   * on, since editing them in place makes them client state. This warms exactly
   * the first render; every later filter is a client fetch.
   *
   * Deliberately without page/perPage: a report describes the whole result set,
   * so paging is not part of its identity and must not split the cache key.
   */
  const filters = {
    q: organizationsSearchParamsCache.get('q'),
    filters: organizationsSearchParamsCache.get('filters'),
    joinOperator: organizationsSearchParamsCache.get('joinOperator'),
    sort: organizationsSearchParamsCache.get('sort')
  };

  const queryClient = getQueryClient();
  /*
   * The results table's own query. The constants must match what the workspace
   * builds — only `criteria` and `sections` change what the server returns, so
   * the rest is pinned on both sides and the two keys hash identically. Get one
   * of them wrong and the page silently refetches on mount instead of hydrating.
   */
  void queryClient.prefetchQuery(
    organizationReportRunOptions({
      title: '',
      criteria: filters,
      groupBy: 'district',
      sections: ['table'],
      columns: []
    })
  );
  void queryClient.prefetchQuery(reportTemplatesQueryOptions());
  // The filter builder's option lists. Without this the workspace suspends as a
  // whole on first paint, taking the criteria bar down with it.
  void queryClient.prefetchQuery(organizationFacetsQueryOptions());

  // Rendered on the server so the print header and the export link agree on the
  // moment the report describes.
  const generatedAt = new Date().toISOString();

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.reportTitle}
      pageDescription={ORGANIZATION_LABELS.page.reportDescription}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ReportWorkspace generatedAt={generatedAt} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-16 w-full rounded-xl' />
      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <Skeleton className='h-96 w-full rounded-xl' />
        <div className='flex flex-col gap-4'>
          <Skeleton className='h-56 w-full rounded-xl' />
          <Skeleton className='h-40 w-full rounded-xl' />
        </div>
      </div>
    </div>
  );
}
