import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense } from 'react';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardOverviewQueryOptions } from '@/features/organizations/api/queries';
import { DashboardOverview } from '@/features/organizations/components/dashboard-overview';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';

const LABELS = ORGANIZATION_LABELS.dashboard;

export const metadata = {
  title: LABELS.title
};

/**
 * The dashboard landing page.
 *
 * Deliberately guarded with `requireUser()` and NOT `requirePagePermission()`:
 * this route is the fallback every other permission redirect sends people to,
 * so a permission check that redirected would send an unauthorized user here,
 * which would redirect them here, forever. It must stay reachable by any signed-
 * in account.
 *
 * What it *shows* is gated instead. The aggregate below is registry data, so it
 * is rendered only for a user who may read the registry; everyone else gets an
 * explanation rather than a crash from the service's own check.
 */
export default async function Page() {
  await requireUser();

  const [canReadRegistry, canViewReports] = await Promise.all([
    can(PERMISSIONS.ORGANIZATIONS_READ),
    can(PERMISSIONS.REPORTS_VIEW)
  ]);

  const queryClient = getQueryClient();
  // Prefetching without the permission would throw inside a fire-and-forget
  // promise nothing awaits — an unhandled rejection in the server log for a
  // panel that is not going to be rendered anyway.
  if (canReadRegistry) void queryClient.prefetchQuery(dashboardOverviewQueryOptions());

  return (
    <PageContainer
      pageTitle={LABELS.title}
      pageDescription={LABELS.description}
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          {/* Each shortcut points at a page with its own permission, so offering
              one the user cannot open would be a link straight to a redirect. */}
          {canReadRegistry && (
            <Button
              variant='outline'
              size='sm'
              nativeButton={false}
              render={<Link href='/dashboard/organizations' aria-label={LABELS.actions.browse} />}
            >
              <Icons.building />
              {LABELS.actions.browse}
            </Button>
          )}
          {canViewReports && (
            <Button
              variant='outline'
              size='sm'
              nativeButton={false}
              render={
                <Link href='/dashboard/organizations/reports' aria-label={LABELS.actions.report} />
              }
            >
              <Icons.report />
              {LABELS.actions.report}
            </Button>
          )}
        </div>
      }
    >
      {canReadRegistry ? (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardOverview />
          </Suspense>
        </HydrationBoundary>
      ) : (
        <NoRegistryAccess />
      )}
    </PageContainer>
  );
}

function NoRegistryAccess() {
  return (
    <div className='flex flex-col items-center justify-center gap-2 py-24 text-center'>
      <Icons.warning className='text-muted-foreground size-8' />
      <p className='font-medium'>{LABELS.noAccess.title}</p>
      <p className='text-muted-foreground max-w-md text-sm'>{LABELS.noAccess.description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-24 w-full' />
        ))}
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-72 w-full lg:col-span-2' />
        <Skeleton className='h-72 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Skeleton className='h-80 w-full' />
        <Skeleton className='h-80 w-full' />
      </div>
    </div>
  );
}
