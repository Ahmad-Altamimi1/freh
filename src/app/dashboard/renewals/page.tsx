import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { renewalBoardQueryOptions } from '@/features/renewals/api/queries';
import { RenewalBoard } from '@/features/renewals/components/renewal-board';
import { RENEWAL_LABELS } from '@/features/renewals/constants/labels';
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getQueryClient } from '@/lib/query-client';

const LABELS = RENEWAL_LABELS.page;

export const metadata = {
  title: LABELS.title
};

/**
 * The board-renewal tracker.
 *
 * Standard prefetch-on-server + `useSuspenseQuery`-on-client pair: the board is
 * one aggregate over two tables and is worth streaming rather than blocking the
 * shell on.
 */
export default async function Page() {
  await requirePagePermission(PERMISSIONS.RENEWALS_READ);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(renewalBoardQueryOptions());

  return (
    <PageContainer pageTitle={LABELS.title} pageDescription={LABELS.description}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<BoardSkeleton />}>
          <RenewalBoard />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}

function BoardSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-28 w-full rounded-2xl' />
      <div className='flex gap-4 overflow-hidden'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-64 w-72 shrink-0 rounded-xl' />
        ))}
      </div>
    </div>
  );
}
