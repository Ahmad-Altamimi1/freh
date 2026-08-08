import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Saved, named report definitions for the organizations registry.
 *
 * Templates are shared rather than per-user: the directorate runs the same
 * handful of recurring reports ("التقرير الشهري", "الجمعيات المنتهية دورتها"),
 * and scoping them to whoever first built one would mean every colleague
 * rebuilding the same criteria. `createdBy` records authorship for the audit
 * trail without restricting who may run it.
 *
 * `definition` is deliberately untyped at this layer. The column holds a
 * `ReportDefinition` (see `@/features/organizations/api/types`), but the schema
 * stays ignorant of feature types for two reasons: drizzle-kit parses this file
 * outside the Next.js module graph, and JSONB read back from Postgres is
 * untrusted shape regardless of what was written. The service validates it with
 * Zod on the way out, which is where a shape check belongs.
 */
export const reportTemplates = pgTable(
  'report_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Display name, unique so the template list cannot show two identical rows. */
    name: text('name').notNull(),

    description: text('description'),

    /** A serialized `ReportDefinition`. Validated on read, never trusted raw. */
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),

    /**
     * Supabase `auth.users.id`. Plain column, no `.references()` — `auth.users`
     * lives outside drizzle-kit's `schemaFilter: ['public']`, so there is no
     * Drizzle table to reference. Same reasoning as `notifications.recipientId`.
     */
    createdBy: uuid('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('report_templates_name_key').on(table.name),
    index('report_templates_created_by_idx').on(table.createdBy)
  ]
);

export type ReportTemplateRow = typeof reportTemplates.$inferSelect;
export type NewReportTemplateRow = typeof reportTemplates.$inferInsert;
