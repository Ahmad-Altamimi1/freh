import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PageContainer from '@/components/layout/page-container';
import { correspondenceByIdOptions } from '@/features/correspondences/api/queries';
import { CorrespondenceDetailPage } from '@/features/correspondences/components/correspondence-detail-page';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { canAny, requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'بيانات المراسلة'
};

type PageProps = { params: Promise<{ correspondenceId: string }> };

export default async function Page(props: PageProps) {
  // Checked directly here (rather than left to the fire-and-forget prefetch
  // below) so `canEdit` is available to gate the Edit/Delete buttons.
  await requirePagePermission(PERMISSIONS.CORRESPONDENCES_READ);
  const canEdit = await canAny([
    PERMISSIONS.CORRESPONDENCES_UPDATE,
    PERMISSIONS.CORRESPONDENCES_DELETE
  ]);
  const params = await props.params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(correspondenceByIdOptions(params.correspondenceId));

  return (
    <PageContainer pageTitle={CORRESPONDENCE_LABELS.page.detailTitle}>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CorrespondenceDetailPage correspondenceId={params.correspondenceId} canEdit={canEdit} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
