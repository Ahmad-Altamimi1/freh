import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { rolesQueryOptions } from '@/features/roles/api/queries';
import { RoleFormSheetTrigger } from '@/features/roles/components/role-form-sheet';
import { RolesListing } from '@/features/roles/components/roles-listing';
import { ROLES_PAGE_LABELS } from '@/features/roles/constants/labels';
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'الأدوار والصلاحيات'
};

export default async function Page() {
  // Who can do what is itself sensitive: this page is the map of the
  // authorization model. The service repeats the check on every read and write —
  // this redirect is only the friendly half.
  await requirePagePermission(PERMISSIONS.ACCESS_MANAGE);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(rolesQueryOptions());

  return (
    <PageContainer
      pageTitle={ROLES_PAGE_LABELS.title}
      pageDescription={ROLES_PAGE_LABELS.description}
      pageHeaderAction={<RoleFormSheetTrigger />}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<RolesSkeleton />}>
          <RolesListing />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}

function RolesSkeleton() {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className='h-48 w-full' />
      ))}
    </div>
  );
}
