import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

import PageContainer from '@/components/layout/page-container';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { correspondencesSearchParamsCache } from '@/features/correspondences/api/search-params';
import CorrespondencesListing from '@/features/correspondences/components/correspondences-listing';
import { CORRESPONDENCE_LABELS } from '@/features/correspondences/constants/labels';
import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'المراسلات'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  // The dashboard layout already calls this, but the check is repeated
  // wherever data is actually reached — the layout is not a boundary this
  // page controls.
  const user = await requireUser();

  const searchParams = await props.searchParams;
  correspondencesSearchParamsCache.parse(searchParams);

  const canEdit = hasAnyRole(user, ['admin']);

  return (
    <PageContainer
      pageTitle={CORRESPONDENCE_LABELS.page.listTitle}
      pageDescription={CORRESPONDENCE_LABELS.page.listDescription}
      pageHeaderAction={
        canEdit ? (
          <Link
            href='/dashboard/correspondences/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <Icons.add className='me-2 h-4 w-4' />
            {CORRESPONDENCE_LABELS.actions.create}
          </Link>
        ) : null
      }
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
