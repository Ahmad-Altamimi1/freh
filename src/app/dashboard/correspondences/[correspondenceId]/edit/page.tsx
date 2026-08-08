import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import PageContainer from '@/components/layout/page-container';
import {
  correspondenceByIdOptions,
  correspondenceOrganizationOptionsQueryOptions
} from '@/features/correspondences/api/queries';
import { EditCorrespondenceView } from '@/features/correspondences/components/correspondence-form';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getQueryClient } from '@/lib/query-client';

export const metadata = {
  title: 'تعديل المراسلة'
};

type PageProps = { params: Promise<{ correspondenceId: string }> };

export default async function Page(props: PageProps) {
  const canEdit = await can(PERMISSIONS.CORRESPONDENCES_UPDATE);
  const params = await props.params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(correspondenceByIdOptions(params.correspondenceId));
  void queryClient.prefetchQuery(correspondenceOrganizationOptionsQueryOptions());

  return (
    <PageContainer
      pageTitle={CORRESPONDENCE_LABELS.page.editTitle}
      access={canEdit}
      accessFallback={
        <p className='text-muted-foreground text-center text-lg'>
          {CORRESPONDENCE_LABELS.page.noAccess}
        </p>
      }
    >
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <EditCorrespondenceView correspondenceId={params.correspondenceId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
