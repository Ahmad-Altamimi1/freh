import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { organizationsSearchParamsCache } from '@/features/organizations/api/search-params';
import { OrganizationCreateButton } from '@/features/organizations/components/organization-create-button';
import { OrganizationImportButton } from '@/features/organizations/components/organizations-import';
import OrganizationsListing from '@/features/organizations/components/organizations-listing';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { can, canAny, requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';

export const metadata = {
  title: 'الجمعيات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  // The dashboard layout already gates on a session, but the check is repeated
  // wherever data is actually reached — the layout is not a boundary this page
  // controls.
  await requirePagePermission(PERMISSIONS.ORGANIZATIONS_READ);

  const searchParams = await props.searchParams;
  organizationsSearchParamsCache.parse(searchParams);

  // Each header control asks for the capability it actually uses: a role may
  // import without creating by hand, or create without deleting.
  const [canCreate, canImport, canEdit] = await Promise.all([
    can(PERMISSIONS.ORGANIZATIONS_CREATE),
    can(PERMISSIONS.ORGANIZATIONS_IMPORT),
    canAny([PERMISSIONS.ORGANIZATIONS_UPDATE, PERMISSIONS.ORGANIZATIONS_DELETE])
  ]);

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.listTitle}
      pageDescription={ORGANIZATION_LABELS.page.listDescription}
      pageHeaderAction={
        canCreate || canImport ? (
          <div className='flex items-center gap-2'>
            {canImport && <OrganizationImportButton />}
            {canCreate && <OrganizationCreateButton />}
          </div>
        ) : null
      }
    >
      {/* 11 data columns, plus the row-actions column for editors. */}
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={canEdit ? 12 : 11} rowCount={10} filterCount={2} />
        }
      >
        <OrganizationsListing />
      </Suspense>
    </PageContainer>
  );
}
