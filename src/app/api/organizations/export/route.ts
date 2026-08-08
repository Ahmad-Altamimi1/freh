import type { NextRequest } from 'next/server';

import { describeFilters } from '@/features/organizations/api/describe-filters';
import { organizationsSearchParams } from '@/features/organizations/api/search-params';
import { getAllOrganizations } from '@/features/organizations/api/service';
import { buildOrganizationsExport } from '@/features/organizations/api/workbook-export';
import { canAny } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { xlsxResponse } from '../response';

/**
 * Exports the rows matching the current filter.
 *
 * The filter is re-parsed from the query string and the query is re-run
 * server-side. Accepting a client-supplied list of rows would be both a trust
 * problem and a correctness one — the browser only ever holds the current page,
 * so an export built from it would silently contain ten rows instead of all of
 * them.
 *
 * EITHER export permission opens this route, rather than one specific one. The
 * same endpoint backs three surfaces — the registry toolbar, the report page and
 * the report builder — over identical rows and an identical filter. Requiring
 * `organizations:export` would break the reporter role; requiring
 * `reports:export:excel` would break the registry toolbar; requiring both would
 * break each of them for the other's sake. What either permission actually
 * grants is "may take these rows out as a file", which is exactly this route.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!(await canAny([PERMISSIONS.ORGANIZATIONS_EXPORT, PERMISSIONS.REPORTS_EXPORT_EXCEL]))) {
    return new Response('Forbidden', { status: 403 });
  }

  const params = request.nextUrl.searchParams;

  const filters = {
    q: organizationsSearchParams.q.parseServerSide(params.get('q') ?? undefined),
    filters: organizationsSearchParams.filters.parseServerSide(params.get('filters') ?? undefined),
    joinOperator: organizationsSearchParams.joinOperator.parseServerSide(
      params.get('joinOperator') ?? undefined
    ),
    sort: organizationsSearchParams.sort.parseServerSide(params.get('sort') ?? undefined)
  };

  const organizations = await getAllOrganizations(filters);
  const generatedAt = new Date();

  const buffer = await buildOrganizationsExport({
    organizations,
    appliedFilters: describeFilters(filters),
    generatedAt
  });

  const stamp = generatedAt.toISOString().slice(0, 10);
  return xlsxResponse(buffer, `الجمعيات-${stamp}.xlsx`);
}
