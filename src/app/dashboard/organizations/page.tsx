import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { organizationsSearchParamsCache } from '@/features/organizations/api/search-params';
import { OrganizationCreateButton } from '@/features/organizations/components/organization-create-button';
import { OrganizationImportButton } from '@/features/organizations/components/organizations-import';
import OrganizationsListing from '@/features/organizations/components/organizations-listing';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { requireUser } from '@/lib/auth/session';
import { hasAnyRole } from '@/lib/auth/roles';

export const metadata = {
  title: 'الجمعيات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  // The dashboard layout already calls this, but the check is repeated wherever
  // data is actually reached — the layout is not a boundary this page controls.
  const user = await requireUser();

  const searchParams = await props.searchParams;
  organizationsSearchParamsCache.parse(searchParams);

  // One role gates create, edit, delete and import alike — they are all
  // writes to the same registry.
  const canEdit = hasAnyRole(user, ['admin']);

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.listTitle}
      pageDescription={ORGANIZATION_LABELS.page.listDescription}
      pageHeaderAction={
        canEdit ? (
          <div className='flex items-center gap-2'>
            <OrganizationImportButton />
            <OrganizationCreateButton />
          </div>
        ) : null
      }
    >
      {/* 8 data columns, plus the row-actions column for editors. */}
      <Suspense
        fallback={<DataTableSkeleton columnCount={canEdit ? 9 : 8} rowCount={10} filterCount={2} />}
      >
        <OrganizationsListing />
      </Suspense>
    </PageContainer>
  );
}
