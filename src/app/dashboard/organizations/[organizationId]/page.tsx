import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { organizationByIdOptions } from '@/features/organizations/api/queries';
import PageContainer from '@/components/layout/page-container';
import { OrganizationDetailPage } from '@/features/organizations/components/organization-detail-page';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';

export const metadata = {
  title: 'بيانات الجمعية'
};

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(organizationByIdOptions(params.organizationId));

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.detailTitle}
      pageDescription={ORGANIZATION_LABELS.page.detailDescription}
    >
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrganizationDetailPage organizationId={params.organizationId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
