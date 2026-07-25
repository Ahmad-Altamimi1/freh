import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';

import { notificationsQueryOptions } from '@/features/notifications/api/queries';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { NOTIFICATION_LABELS } from '@/features/notifications/constants/labels';
import { Skeleton } from '@/components/ui/skeleton';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: NOTIFICATION_LABELS.page.title
};

export default async function Page() {
  // The dashboard layout already calls this, but the check is repeated wherever
  // data is actually reached — the layout is not a boundary this page controls.
  await requireUser();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(notificationsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<NotificationsPageSkeleton />}>
        <NotificationsPage />
      </Suspense>
    </HydrationBoundary>
  );
}

function NotificationsPageSkeleton() {
  return (
    <div className='flex flex-col gap-4 p-4 md:p-6'>
      <Skeleton className='h-8 w-48' />
      <div className='flex flex-col gap-2'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-20 w-full rounded-2xl' />
        ))}
      </div>
    </div>
  );
}
