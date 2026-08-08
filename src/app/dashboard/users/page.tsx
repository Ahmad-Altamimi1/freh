import PageContainer from '@/components/layout/page-container';
import UserListingPage from '@/features/users/components/user-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { usersInfoContent } from '@/features/users/info-content';
import { USERS_PAGE_LABELS } from '@/features/users/constants/labels';
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet';

export const metadata = {
  title: 'لوحة التحكم: المستخدمون'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage(props: PageProps) {
  // The directory is every account's email address and the screen hands out
  // roles, so it needs the same permission the rest of access control does.
  // The service repeats the check — this redirect is only the friendly half.
  await requirePagePermission(PERMISSIONS.ACCESS_MANAGE);

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle={USERS_PAGE_LABELS.title}
      pageDescription={USERS_PAGE_LABELS.description}
      infoContent={usersInfoContent}
      pageHeaderAction={<UserFormSheetTrigger />}
    >
      <UserListingPage />
    </PageContainer>
  );
}
