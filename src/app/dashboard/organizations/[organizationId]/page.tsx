import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { organizationByIdOptions } from '@/features/organizations/api/queries';
import PageContainer from '@/components/layout/page-container';
import { OrganizationDetailPage } from '@/features/organizations/components/organization-detail-page';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import type { Organization } from '@/features/organizations/api/types';

export const metadata = {
  title: 'بيانات الجمعية'
};

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function Page(props: PageProps) {
  const params = await props.params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(organizationByIdOptions(params.organizationId));

  const organization = queryClient.getQueryData<Organization | null>(
    organizationByIdOptions(params.organizationId).queryKey
  );

  // The classification/district pair identifies the organization at a glance,
  // so it belongs in the page header rather than repeated inside the record.
  const pageDescription =
    [organization?.classification, organization?.district].filter(Boolean).join(' · ') || undefined;

  return (
    <PageContainer
      pageTitle={organization?.name ?? ORGANIZATION_LABELS.page.detailTitle}
      pageDescription={pageDescription}
    >
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrganizationDetailPage organizationId={params.organizationId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
