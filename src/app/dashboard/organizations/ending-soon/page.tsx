import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { organizationsEndingSoonSearchParamsCache } from '@/features/organizations/api/search-params';
import OrganizationsEndingSoonListing from '@/features/organizations/components/organizations-ending-soon-listing';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { requireUser } from '@/lib/auth/session';
import { hasAnyRole } from '@/lib/auth/roles';

export const metadata = {
  title: ORGANIZATION_LABELS.page.endingSoonTitle
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const user = await requireUser();

  const searchParams = await props.searchParams;
  organizationsEndingSoonSearchParamsCache.parse(searchParams);

  const canEdit = hasAnyRole(user, ['admin']);

  return (
    <PageContainer
      pageTitle={ORGANIZATION_LABELS.page.endingSoonTitle}
      pageDescription={ORGANIZATION_LABELS.page.endingSoonDescription}
    >
      {/* 11 data columns + the remaining-time column, plus row-actions for editors. */}
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={canEdit ? 13 : 12} rowCount={10} filterCount={2} />
        }
      >
        <OrganizationsEndingSoonListing />
      </Suspense>
    </PageContainer>
  );
}
