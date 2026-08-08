import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import {
  getOrganizationsNearingTermEnd,
  insertTermEndingNotifications,
  listNotificationRecipientIds
} from '@/features/notifications/lib/term-ending';
import { auditLog } from '@/lib/audit';
import { getServerEnv } from '@/lib/env';

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

    const [organizationsInWindow, recipientIds] = await Promise.all([
      getOrganizationsNearingTermEnd(TERM_END_NOTICE_DAYS),
      listNotificationRecipientIds()
    ]);

    const created = await insertTermEndingNotifications(recipientIds, organizationsInWindow);

    await auditLog({
      action: 'CREATE',
      entityType: 'notification_batch',
      actor: { id: null, type: 'system' },
      metadata: {
        organizationsInWindow: organizationsInWindow.length,
        recipientCount: recipientIds.length,
        created
      }
    });

    return NextResponse.json({
      organizationsInWindow: organizationsInWindow.length,
      recipientCount: recipientIds.length,
      created
    });
  } catch (error) {
    console.error('term-notifications cron failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
