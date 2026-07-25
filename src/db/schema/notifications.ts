import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * One row per (notification, recipient) — deliberately denormalized rather
 * than a broadcast row plus a separate read-state join table. At this app's
 * scale (a handful of admins) a join table buys nothing and costs a join on
 * every read; denormalizing also makes "admin-only" structurally true rather
 * than a filter to remember, since a row simply does not exist for anyone
 * who isn't its recipient.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Supabase `auth.users.id`. Plain column, no `.references()` — `auth.users`
     * lives outside drizzle-kit's `schemaFilter: ['public']`, so there is no
     * Drizzle table to reference. Same reasoning as the audit log's `actorId`.
     */
    recipientId: uuid('recipient_id').notNull(),

    /** Free-form discriminator, e.g. 'term_ending_soon' — not a pg enum, so a
     *  new notification type never needs a migration to introduce. */
    type: text('type').notNull(),

    title: text('title').notNull(),
    body: text('body').notNull(),

    status: text('status').notNull().default('unread'),

    /** What this notification is about. Nullable — not every notification
     *  refers to a record. Mirrors auditLog's entityType/entityId shape. */
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),

    /** One optional action button, precomputed at write time so this table
     *  stays ignorant of what "organizations" (or any other feature) is. */
    actionHref: text('action_href'),
    actionLabel: text('action_label'),

    /**
     * Idempotency key: `{type}:{entityId}:{whatever must change to re-notify}`,
     * e.g. `term_ending_soon:{orgId}:{termEnd}`. Unique together with
     * `recipientId` below — the same key is deliberately reused across every
     * admin's own row for one event.
     */
    dedupeKey: text('dedupe_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // Idempotency constraint AND the onConflictDoNothing target for the cron's
    // upsert.
    uniqueIndex('notifications_recipient_dedupe_key').on(table.recipientId, table.dedupeKey),
    index('notifications_recipient_status_idx').on(table.recipientId, table.status),
    index('notifications_recipient_created_at_idx').on(table.recipientId, table.createdAt),
    check('notifications_status_check', sql`${table.status} in ('unread','read','archived')`)
  ]
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
