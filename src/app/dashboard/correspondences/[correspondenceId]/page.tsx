import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PageContainer from '@/components/layout/page-container';
import { correspondenceByIdOptions } from '@/features/correspondences/api/queries';
import { CorrespondenceDetailPage } from '@/features/correspondences/components/correspondence-detail-page';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'بيانات المراسلة'
};

type PageProps = { params: Promise<{ correspondenceId: string }> };

export default async function Page(props: PageProps) {
  // Called directly here (rather than left to the fire-and-forget prefetch
  // below) so `canEdit` is available to gate the Edit/Delete buttons.
  const user = await requireUser();
  const params = await props.params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(correspondenceByIdOptions(params.correspondenceId));

  return (
    <PageContainer pageTitle={CORRESPONDENCE_LABELS.page.detailTitle}>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CorrespondenceDetailPage
            correspondenceId={params.correspondenceId}
            canEdit={hasAnyRole(user, ['admin'])}
          />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
