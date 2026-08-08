import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { correspondencesSearchParamsCache } from '@/features/correspondences/api/search-params';
import { CorrespondenceCreateButton } from '@/features/correspondences/components/correspondence-create-button';
import CorrespondencesListing from '@/features/correspondences/components/correspondences-listing';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { can, canAny, requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';

export const metadata = {
  title: 'المراسلات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  await requirePagePermission(PERMISSIONS.CORRESPONDENCES_READ);

  const searchParams = await props.searchParams;
  correspondencesSearchParamsCache.parse(searchParams);

  const [canCreate, canEdit] = await Promise.all([
    can(PERMISSIONS.CORRESPONDENCES_CREATE),
    canAny([PERMISSIONS.CORRESPONDENCES_UPDATE, PERMISSIONS.CORRESPONDENCES_DELETE])
  ]);

  return (
    <PageContainer
      pageTitle={CORRESPONDENCE_LABELS.page.listTitle}
      pageDescription={CORRESPONDENCE_LABELS.page.listDescription}
      pageHeaderAction={canCreate ? <CorrespondenceCreateButton /> : null}
    >
      {/* 5 data columns, plus the row-actions column for editors. */}
      <Suspense
        fallback={<DataTableSkeleton columnCount={canEdit ? 7 : 6} rowCount={10} filterCount={2} />}
      >
        <CorrespondencesListing />
      </Suspense>
    </PageContainer>
  );
}
