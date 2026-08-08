import { buildMembersImportTemplate } from '@/features/organizations/api/workbook-export';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { xlsxResponse } from '../response';

/** Blank import template for member data. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Gated on the import permission rather than on export: a blank template is
  // worthless to anyone who cannot upload it back, and it carries no data.
  if (!(await can(PERMISSIONS.ORGANIZATIONS_IMPORT))) {
    return new Response('Forbidden', { status: 403 });
  }

  return xlsxResponse(await buildMembersImportTemplate(), 'نموذج-استيراد-الأعضاء.xlsx');
}
