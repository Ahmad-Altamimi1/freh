import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { StoredFile } from '@/lib/storage/types';
import { organizations } from './organizations';

export const CORRESPONDENCE_TYPES = ['صادر', 'وارد'] as const;
export type CorrespondenceType = (typeof CORRESPONDENCE_TYPES)[number];

/** A `StoredFile` plus when it was attached — `StoredFile` itself carries no time dimension. */
export type CorrespondenceFile = StoredFile & { uploadedAt: string };

/**
 * Correspondence log (المراسلات). Each row is one incoming/outgoing
 * correspondence tied to the organization it concerns.
 */
export const correspondences = pgTable(
  'correspondences',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    name: text('name').notNull(),

    /** `name` folded through `normalizeArabic()`. Same role as organizations.nameNormalized. */
    nameNormalized: text('name_normalized').notNull(),

    /** صادر | وارد. Checked at the DB, not a pg enum — see notifications.status for the same idiom. */
    type: text('type').notNull().$type<CorrespondenceType>(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    /** Uploaded attachments. Denormalized JSONB — mirrors organizations.members at this app's scale. */
    files: jsonb('files').$type<CorrespondenceFile[]>().default([]).notNull(),

    /** Normalized haystack for quick search, trigram-indexed. Mirrors organizations.searchKey. */
    searchKey: text('search_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('correspondences_organization_id_idx').on(table.organizationId),
    index('correspondences_type_idx').on(table.type),
    index('correspondences_created_at_idx').on(table.createdAt),
    check('correspondences_type_check', sql`${table.type} in ('صادر', 'وارد')`)
  ]
);

export type CorrespondenceRow = typeof correspondences.$inferSelect;
export type NewCorrespondenceRow = typeof correspondences.$inferInsert;
