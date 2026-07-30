import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { organizationByIdOptions } from '@/features/organizations/api/queries';
import PageContainer from '@/components/layout/page-container';
import { MembersImport } from '@/features/organizations/components/members-import';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';

export const metadata = {
  title: 'استيراد أعضاء الجمعية'
};

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(organizationByIdOptions(params.organizationId));

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.members.importTitle}
      pageDescription={ORGANIZATION_LABELS.members.importDescription}
    >
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <MembersImport organizationId={params.organizationId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
