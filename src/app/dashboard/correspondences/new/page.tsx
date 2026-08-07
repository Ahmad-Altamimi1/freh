import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PageContainer from '@/components/layout/page-container';
import { correspondenceOrganizationOptionsQueryOptions } from '@/features/correspondences/api/queries';
import { CorrespondenceForm } from '@/features/correspondences/components/correspondence-form';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'إضافة مراسلة'
};

export default async function Page() {
  const user = await requireUser();
  const canEdit = hasAnyRole(user, ['admin']);

  const queryClient = getQueryClient();
  // Unlike the create sheet organizations uses (opened on top of an already
  // warm list page), this is a directly-navigable route with no guarantee the
  // list page ran first — the combobox's options must be prefetched here.
  void queryClient.prefetchQuery(correspondenceOrganizationOptionsQueryOptions());

  return (
    <PageContainer
      pageTitle={CORRESPONDENCE_LABELS.page.createTitle}
      pageDescription={CORRESPONDENCE_LABELS.page.createDescription}
      access={canEdit}
      accessFallback={
        <p className='text-muted-foreground text-center text-lg'>
          {CORRESPONDENCE_LABELS.page.noAccess}
        </p>
      }
    >
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CorrespondenceForm initialData={null} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
