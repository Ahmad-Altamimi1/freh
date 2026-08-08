import { notFound } from 'next/navigation';
import type { SearchParams } from 'nuqs/server';

import { getCorrespondencesByOrganization } from '@/features/correspondences/api/service';
import { getOrganizationById } from '@/features/organizations/api/service';
import { OrganizationProfileDocument } from '@/features/organizations/components/organization-profile-document';
import { addDaysUTC, todayUTC } from '@/features/organizations/lib/term';
import { can, requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getServerEnv } from '@/lib/env';
import { AutoPrint } from '../../auto-print';

export const metadata = {
  title: 'ملف الجمعية',
  robots: { index: false, follow: false }
};

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * One organization's file, rendered as a printable A4 document.
 *
 * Reached three ways, all as plain GETs: the "ملف الجمعية" button on the
 * organization's page, the browser's print dialog, and the headless-Chromium
 * PDF route.
 *
 * The permission check here is the authorization boundary. This route sits
 * outside `/dashboard`, so the proxy's redirect does not apply to it by prefix —
 * the proxy was extended to cover `/print`, but that is UX, and this is the
 * check.
 *
 * It asks for `reports:export:pdf` for the same reason the report's print route
 * does: this page IS the PDF, and gating it on a weaker permission would leave
 * "can look but not download" bypassable with Ctrl+P. `organizations:read` is
 * enforced separately by `getOrganizationById` itself.
 *
 * The correspondence log is fetched only if the user may read it. A missing
 * permission omits that section with a stated reason rather than failing the
 * whole document — the rest of the file is still theirs to print.
 */
export default async function Page(props: PageProps) {
  await requirePagePermission(PERMISSIONS.REPORTS_EXPORT_PDF);

  const { organizationId } = await props.params;
  const searchParams = await props.searchParams;

  const organization = await getOrganizationById(organizationId);
  if (!organization) notFound();

  const correspondences = (await can(PERMISSIONS.CORRESPONDENCES_READ))
    ? await getCorrespondencesByOrganization(organizationId)
    : null;

  const today = todayUTC();

  return (
    <>
      {searchParams.autoprint === '1' && <AutoPrint />}
      <OrganizationProfileDocument
        organization={organization}
        correspondences={correspondences}
        termWindow={{
          today,
          // The same notice window the dashboard and the reminder cron use, so
          // "تنتهي قريبًا" means one thing across the whole application.
          noticeEnd: addDaysUTC(today, getServerEnv().TERM_END_NOTICE_DAYS)
        }}
        generatedAt={new Date().toISOString()}
      />
    </>
  );
}
