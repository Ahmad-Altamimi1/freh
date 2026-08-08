import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import React, { Suspense } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';
import { notificationsQueryOptions } from '@/features/notifications/api/queries';
import {
  NotificationCenter,
  NotificationCenterSkeleton
} from '@/features/notifications/components/notification-center';
import { getQueryClient } from '@/lib/query-client';

export default async function Header() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(notificationsQueryOptions());

  return (
    <header className='bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14'>
      <div className='flex items-center gap-2 px-4'>
        <SidebarTrigger className='-ms-1' />
        <Separator orientation='vertical' className='me-2 h-4' />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2 px-4'>
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <ThemeModeToggle />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<NotificationCenterSkeleton />}>
            <NotificationCenter />
          </Suspense>
        </HydrationBoundary>
      </div>
    </header>
  );
}
