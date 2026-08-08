import type { NextRequest } from 'next/server';

import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { printFailureResponse, renderPrintPageToPdf } from '@/lib/pdf/print-to-pdf';
import { pdfResponse } from '../../response';

const DOC = ORGANIZATION_LABELS.document;

/**
 * Renders the printable report route to a PDF.
 *
 * The mechanics — headless Chromium, the repeating margin boxes, the webfont
 * wait — live in `@/lib/pdf/print-to-pdf`, shared with the per-organization
 * profile document.
 */

// Chromium cannot run on the edge runtime, and the render needs longer than the
// default serverless ceiling on a report with a few thousand detail rows.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!(await can(PERMISSIONS.REPORTS_EXPORT_PDF))) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    // The report is described entirely by the print route's own query string, so
    // this endpoint forwards rather than re-parses it. Only the two parameters
    // that identify a report are copied — never the whole query.
    const buffer = await renderPrintPageToPdf({
      request,
      printPath: '/print/organizations-report',
      searchParams: {
        d: request.nextUrl.searchParams.get('d') ?? undefined,
        template: request.nextUrl.searchParams.get('template') ?? undefined
      },
      letterhead: {
        kingdom: DOC.kingdom,
        ministry: DOC.ministry,
        directorate: DOC.directorate,
        runningTitle: DOC.runningTitle,
        printedNote: DOC.printedNote
      }
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return pdfResponse(buffer, `تقرير-الجمعيات-${stamp}.pdf`);
  } catch (error) {
    return printFailureResponse(error, 'report');
  }
}
