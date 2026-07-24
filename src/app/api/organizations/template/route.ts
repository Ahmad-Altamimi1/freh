import { buildOrganizationsTemplate } from '@/features/organizations/api/workbook-export';
import { hasAnyRole } from '@/lib/auth/roles';
import { getCurrentUser } from '@/lib/auth/session';
import { xlsxResponse } from '../response';

/** Blank import template. Same gate as the import itself. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!hasAnyRole(user, ['admin'])) {
    return new Response('Forbidden', { status: 403 });
  }

  return xlsxResponse(await buildOrganizationsTemplate(), 'نموذج-استيراد-الجمعيات.xlsx');
}
