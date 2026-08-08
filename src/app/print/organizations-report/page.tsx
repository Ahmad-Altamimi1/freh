import type { SearchParams } from 'nuqs/server';

import { describeFilters } from '@/features/organizations/api/describe-filters';
import { getReportTemplates, runOrganizationReport } from '@/features/organizations/api/service';
import { ReportDocument } from '@/features/organizations/components/report-document';
import { decodeReportDefinition } from '@/features/organizations/lib/report-definition';
import { requirePagePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { AutoPrint } from './auto-print';

export const metadata = {
  title: 'تقرير الجمعيات',
  robots: { index: false, follow: false }
};

type PageProps = { searchParams: Promise<SearchParams> };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Renders a report definition as a printable A4 document.
 *
 * Reached three ways, all as plain GETs: the builder's "preview" link, the
 * browser's print dialog, and the headless-Chromium PDF route. The definition
 * travels in `d` (base64url JSON) or, for a saved report, in `template` (an id).
 *
 * The permission check here is the authorization boundary. This route sits
 * outside `/dashboard`, so the proxy's redirect does not apply to it by prefix —
 * the proxy was extended to cover `/print`, but that is UX, and this is the
 * check.
 *
 * It asks for `reports:export:pdf`, not `reports:view`. This page IS the PDF:
 * the export route renders exactly this URL in headless Chromium, and the print
 * dialog turns it into a file just as readily. Gating it on the weaker
 * view permission would leave "can look but not download" trivially bypassable
 * by opening the preview link and pressing Ctrl+P.
 */
export default async function Page(props: PageProps) {
  await requirePagePermission(PERMISSIONS.REPORTS_EXPORT_PDF);

  const searchParams = await props.searchParams;
  const templateId = firstValue(searchParams.template);

  // A saved template wins over an inline definition: a filed report should
  // reflect what the template says today, not a definition frozen into a link.
  let definition = decodeReportDefinition(firstValue(searchParams.d));
  if (templateId) {
    const template = (await getReportTemplates()).find((row) => row.id === templateId);
    if (template) definition = template.definition;
  }

  const result = await runOrganizationReport(definition);
  const generatedAt = new Date().toISOString();

  return (
    <>
      {firstValue(searchParams.autoprint) === '1' && <AutoPrint />}
      <ReportDocument
        result={result}
        appliedFilters={describeFilters(definition.criteria)}
        generatedAt={generatedAt}
      />
    </>
  );
}
