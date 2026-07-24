import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { describeFilters } from '@/features/organizations/api/describe-filters';
import { organizationReportQueryOptions } from '@/features/organizations/api/queries';
import {
  organizationsSearchParamsCache,
  serializeOrganizationsParams
} from '@/features/organizations/api/search-params';
import { OrganizationsReport } from '@/features/organizations/components/organizations-report';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'تقارير الجمعيات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  await requireUser();

  const searchParams = await props.searchParams;
  organizationsSearchParamsCache.parse(searchParams);

  // Deliberately without page/perPage: a report describes the whole result set,
  // so paging is not part of its identity and must not split the cache key.
  const filters = {
    q: organizationsSearchParamsCache.get('q'),
    filters: organizationsSearchParamsCache.get('filters'),
    joinOperator: organizationsSearchParamsCache.get('joinOperator'),
    sort: organizationsSearchParamsCache.get('sort')
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(organizationReportQueryOptions(filters));

  // Rendered on the server so the print header and the export link agree on the
  // moment the report describes.
  const generatedAt = new Date().toISOString();

  const queryString = serializeOrganizationsParams({
    q: filters.q,
    filters: filters.filters,
    joinOperator: filters.joinOperator,
    sort: filters.sort
  });

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.reportTitle}
      pageDescription={ORGANIZATION_LABELS.page.reportDescription}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ReportSkeleton />}>
          <OrganizationsReport
            filters={filters}
            appliedFilters={describeFilters(filters)}
            queryString={queryString}
            generatedAt={generatedAt}
          />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}

function ReportSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-24 w-full' />
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        {Array.from({ length: 6 }).map((_, index) => (
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
