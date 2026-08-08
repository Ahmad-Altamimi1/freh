import { and, gte, isNotNull, lte } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

import { getDb } from '@/db';
import { notifications, type NewNotificationRow } from '@/db/schema/notifications';
import { organizations } from '@/db/schema/organizations';
import { serializeOrganizationsParams } from '@/features/organizations/api/search-params';
import { addDaysUTC, todayUTC } from '@/features/organizations/lib/term';
import { getAccessForUser, listUserIdsWithPermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getServerEnv } from '@/lib/env';
import { NOTIFICATION_LABELS } from '../constants/labels';

/**
 * Term-end alerting — the one place that turns "this organization's term is
 * nearly over" into notification rows.
 *
 * Two callers, deliberately: the daily cron (`/api/cron/term-notifications`)
 * fans the alerts out to everyone who can read the registry, and
 * `getNotifications()` re-runs the same write for the *current* user on every
 * read. The second exists because the
 * cron is the only writer otherwise, and Vercel Cron never fires under
 * `next dev` — without it the page is empty locally and stale for anyone who
 * loads it before the day's run. Both paths converge on the same `dedupeKey`,
 * so whichever gets there first wins and the other is a no-op.
 *
 * Plain module — deliberately NOT `'use server'`. That directive makes every
 * export a client-callable RPC endpoint whether or not any UI calls it, and
 * these write notification rows for arbitrary recipients. The cron route guards
 * them with its shared secret; `service.ts` guards them with the signed-in
 * user's own permissions. Neither guard survives being turned into an endpoint.
 */

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

/**
 * Who receives term-end alerts: everyone who can read the registry.
 *
 * Keyed on the capability rather than on the `admin` role. An alert that a term
 * is expiring is only actionable by someone allowed to look the organization up,
 * and tying it to `organizations:read` means a newly created role starts
 * receiving them the moment it is granted that permission — with no change here.
 */
export async function listNotificationRecipientIds(): Promise<string[]> {
  return listUserIdsWithPermission(PERMISSIONS.ORGANIZATIONS_READ);
}

/** One row per (recipient, organization) — see the schema's comment on why this is denormalized. */
export function buildTermEndingSoonRows(
  recipientIds: string[],
  orgs: OrganizationNearingTermEnd[]
): NewNotificationRow[] {
  const rows: NewNotificationRow[] = [];

  for (const org of orgs) {
    const actionHref = `/dashboard/organizations${serializeOrganizationsParams({ q: org.name })}`;
    const dedupeKey = `term_ending_soon:${org.id}:${org.termEnd}`;

    for (const recipientId of recipientIds) {
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

/**
 * Writes the rows, skipping any `(recipient_id, dedupe_key)` already present.
 * Returns how many were actually new — a re-run on the same day inserts none.
 */
export async function insertTermEndingNotifications(
  recipientIds: string[],
  orgs: OrganizationNearingTermEnd[]
): Promise<number> {
  if (recipientIds.length === 0 || orgs.length === 0) return 0;

  const created = await getDb()
    .insert(notifications)
    .values(buildTermEndingSoonRows(recipientIds, orgs))
    .onConflictDoNothing({ target: [notifications.recipientId, notifications.dedupeKey] })
    .returning({ id: notifications.id });

  return created.length;
}

/**
 * Brings one user's term-end notifications up to date, called on every read of
 * the notifications list.
 *
 * Users who cannot read the registry are a no-op: the cron addresses the same
 * audience, and a read must not be what grants someone a notification they
 * would otherwise never receive.
 *
 * Failures are logged, not thrown. This is a refresh bolted onto a read — a
 * transient write error should cost the user the newest alert, not the entire
 * list of ones already stored.
 */
export async function syncTermEndingNotifications(user: User): Promise<number> {
  const { permissions } = await getAccessForUser(user.id);
  if (!permissions.includes(PERMISSIONS.ORGANIZATIONS_READ)) return 0;

  try {
    const orgs = await getOrganizationsNearingTermEnd(getServerEnv().TERM_END_NOTICE_DAYS);
    return await insertTermEndingNotifications([user.id], orgs);
  } catch (error) {
    console.error('syncTermEndingNotifications failed', error);
    return 0;
  }
}
