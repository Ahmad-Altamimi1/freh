import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { getDb } from '@/db';
import { notifications } from '@/db/schema/notifications';
import { auditLog } from '@/lib/audit';
import { getServerEnv } from '@/lib/env';
import {
  buildTermEndingSoonRows,
  getOrganizationsNearingTermEnd,
  listAdminUserIds
} from './notifications-for-term-end';

/**
 * Daily term-end reminder job (see `vercel.json`'s `crons` entry).
 *
 * Runs on the Node.js runtime, not Edge — `getDb()`'s raw TCP Postgres driver
 * and the timing-safe secret comparison below both require it.
 *
 * Vercel Cron never fires under `next dev`; test locally with:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/term-notifications
 *
 * Daily is deliberate, not a placeholder: `term_end` is a calendar date, not a
 * timestamp, so finer-grained scheduling would not change what is detected.
 */
export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${getServerEnv().CRON_SECRET}`;

  const headerBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);

  // Lengths must match before `timingSafeEqual` will even run — comparing
  // them first leaks length, not content, which is the accepted trade-off for
  // a fixed-format bearer-token secret.
  if (headerBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(headerBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { TERM_END_NOTICE_DAYS } = getServerEnv();

    const [organizationsInWindow, adminIds] = await Promise.all([
      getOrganizationsNearingTermEnd(TERM_END_NOTICE_DAYS),
      listAdminUserIds()
    ]);

    if (organizationsInWindow.length === 0 || adminIds.length === 0) {
      return NextResponse.json({
        organizationsInWindow: organizationsInWindow.length,
        adminCount: adminIds.length,
        created: 0
      });
    }

    const rows = buildTermEndingSoonRows(adminIds, organizationsInWindow);

    const created = await getDb()
      .insert(notifications)
      .values(rows)
      .onConflictDoNothing({ target: [notifications.recipientId, notifications.dedupeKey] })
      .returning({ id: notifications.id });

    await auditLog({
      action: 'CREATE',
      entityType: 'notification_batch',
      actor: { id: null, type: 'system' },
      metadata: {
        organizationsInWindow: organizationsInWindow.length,
        adminCount: adminIds.length,
        created: created.length
      }
    });

    return NextResponse.json({
      organizationsInWindow: organizationsInWindow.length,
      adminCount: adminIds.length,
      created: created.length
    });
  } catch (error) {
    console.error('term-notifications cron failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
