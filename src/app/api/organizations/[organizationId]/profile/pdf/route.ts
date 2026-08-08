import type { NextRequest } from 'next/server';

import { getOrganizationById } from '@/features/organizations/api/service';
import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { printFailureResponse, renderPrintPageToPdf } from '@/lib/pdf/print-to-pdf';
import { pdfResponse } from '../../../response';

const DOC = ORGANIZATION_LABELS.document;
const PROFILE = ORGANIZATION_LABELS.profile;

/**
 * Renders one organization's printable profile to a PDF.
 *
 * Shares every mechanism with the report export — see `@/lib/pdf/print-to-pdf`.
 * The organization is looked up here as well as in the print page, for the
 * filename: a file called `profile.pdf` is useless in a folder of fifty of them.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Strips what a filesystem cannot take, leaving Arabic intact.
 *
 * Only the characters Windows and POSIX actually reject are removed — an
 * aggressive allowlist would reduce an Arabic society name to underscores,
 * which is precisely the outcome the `filename*=UTF-8''` header exists to avoid.
 */
function safeFileNamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!(await can(PERMISSIONS.REPORTS_EXPORT_PDF))) {
    return new Response('Forbidden', { status: 403 });
  }

  const { organizationId } = await context.params;

  try {
    // Also the existence check: the print page 404s on an unknown id, which the
    // renderer would otherwise turn into a PDF of a not-found page.
    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return new Response('غير موجود', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const buffer = await renderPrintPageToPdf({
      request,
      printPath: `/print/organization-profile/${encodeURIComponent(organizationId)}`,
      letterhead: {
        kingdom: DOC.kingdom,
        ministry: DOC.ministry,
        directorate: DOC.directorate,
        runningTitle: PROFILE.runningTitle,
        printedNote: DOC.printedNote
      }
    });

    return pdfResponse(buffer, `ملف-${safeFileNamePart(organization.name)}.pdf`);
  } catch (error) {
    return printFailureResponse(error, 'organization profile');
  }
}
