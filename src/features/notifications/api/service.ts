'use server';

import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { notifications, type NotificationRow } from '@/db/schema/notifications';
import { requireUser } from '@/lib/auth/session';
import type { NotificationAction } from '@/components/ui/notification-card';
import type { Notification, NotificationsResponse } from './types';

// ============================================================
// Notifications Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle. `requireUser()` runs before every query, and every
// write additionally scopes its `WHERE` by `recipient_id = user.id` — not just
// `id` — so one user's opaque notification id can never be used to read or
// mutate another user's row.
// ============================================================

/** Generous, not true pagination — plenty of headroom at this app's scale. */
const RECENT_LIMIT = 100;

function toActions(row: NotificationRow): NotificationAction[] {
  if (!row.actionHref || !row.actionLabel) return [];
  return [
    {
      id: 'primary',
      label: row.actionLabel,
      type: 'redirect',
      style: 'primary',
      href: row.actionHref
    }
  ];
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status as Notification['status'],
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    actions: toActions(row)
  };
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const user = await requireUser();

  const rows = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(RECENT_LIMIT);

  return { data: rows.map(toNotification) };
}

export async function markNotificationAsRead(id: string): Promise<{ id: string }> {
  const user = await requireUser();

  const [updated] = await getDb()
    .update(notifications)
    .set({ status: 'read', updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, user.id)))
    .returning({ id: notifications.id });

  if (!updated) throw new Error('الإشعار غير موجود.');

  return updated;
}

export async function markAllNotificationsAsRead(): Promise<{ count: number }> {
  const user = await requireUser();

  const updated = await getDb()
    .update(notifications)
    .set({ status: 'read', updatedAt: new Date() })
    .where(and(eq(notifications.recipientId, user.id), eq(notifications.status, 'unread')))
    .returning({ id: notifications.id });

  return { count: updated.length };
}
