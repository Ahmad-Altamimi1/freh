import { and, gte, isNotNull, lte } from 'drizzle-orm';

import { getDb } from '@/db';
import { organizations } from '@/db/schema/organizations';
import type { NewNotificationRow } from '@/db/schema/notifications';
import { serializeOrganizationsParams } from '@/features/organizations/api/search-params';
import { todayUTC } from '@/features/organizations/lib/term';
import { NOTIFICATION_LABELS } from '@/features/notifications/constants/labels';
import { hasAnyRole } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Plain module — deliberately NOT `'use server'`.
 *
 * A `'use server'` file makes every export a client-callable RPC endpoint
 * regardless of whether any UI calls it (see `organizations/api/service.ts`'s
 * `requireEditor()` comment). These functions have no per-request signed-in
 * user to check against — they're only ever reached through the cron route's
 * own shared-secret check — so this file must stay a plain module, imported
 * only by `route.ts` in this same folder.
 */

/** `dateStr` (`YYYY-MM-DD`) plus `days`, computed via `Date.UTC` integer math. */
function addDaysUTC(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type OrganizationNearingTermEnd = {
  id: string;
  name: string;
  termEnd: string;
};

/** Organizations whose `term_end` falls within `[today, today + noticeDays]`. */
export async function getOrganizationsNearingTermEnd(
  noticeDays: number
): Promise<OrganizationNearingTermEnd[]> {
  const today = todayUTC();
  const windowEnd = addDaysUTC(today, noticeDays);

  const rows = await getDb()
    .select({ id: organizations.id, name: organizations.name, termEnd: organizations.termEnd })
    .from(organizations)
    .where(
      and(
        isNotNull(organizations.termEnd),
        gte(organizations.termEnd, today),
        lte(organizations.termEnd, windowEnd)
      )
    );

  return rows as OrganizationNearingTermEnd[];
}

/** Every Supabase Auth user id holding the `admin` role, via the service-role client. */
export async function listAdminUserIds(): Promise<string[]> {
  const admin = createAdminClient();
  const adminIds: string[] = [];
  let page = 1;

  for (;;) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;

    for (const user of result.data.users) {
      if (hasAnyRole(user, ['admin'])) adminIds.push(user.id);
    }

    if (!result.data.nextPage) break;
    page = result.data.nextPage;
  }

  return adminIds;
}

/** One row per (admin, organization) — see the file-level comment on why this is denormalized. */
export function buildTermEndingSoonRows(
  adminIds: string[],
  orgs: OrganizationNearingTermEnd[]
): NewNotificationRow[] {
  const rows: NewNotificationRow[] = [];

  for (const org of orgs) {
    const actionHref = `/dashboard/organizations${serializeOrganizationsParams({ q: org.name })}`;
    const dedupeKey = `term_ending_soon:${org.id}:${org.termEnd}`;

    for (const recipientId of adminIds) {
      rows.push({
        recipientId,
        type: 'term_ending_soon',
        title: NOTIFICATION_LABELS.termEndingSoon.title,
        body: NOTIFICATION_LABELS.termEndingSoon.body(org.name, org.termEnd),
        entityType: 'organization',
        entityId: org.id,
        actionHref,
        actionLabel: NOTIFICATION_LABELS.termEndingSoon.actionLabel,
        dedupeKey
      });
    }
  }

  return rows;
}
