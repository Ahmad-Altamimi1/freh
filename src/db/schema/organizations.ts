import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export type Member = {
  name: string;
  nationalId: string;
  mobile: string;
  jobTitle: string;
};

/**
 * Registry of cultural societies (الجمعيات الثقافية).
 *
 * Seeded from an MS Access export, which shapes three of the columns:
 *
 *  - `nationalId` is NOT unique and NOT required. Two national IDs in the source
 *    data each belong to two different societies, and two rows carry none at
 *    all. Identity is therefore `(nationalId, nameNormalized)` — see the unique
 *    index in the accompanying SQL migration.
 *  - `mobile` is TEXT, never numeric. Jordanian mobile numbers begin with a
 *    leading zero that any numeric type would silently discard.
 *  - `nameNormalized` and `searchKey` are derived on write via
 *    `@/lib/arabic`. They exist because Arabic has several spellings for the
 *    same word; matching raw text finds nothing.
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** National registration number. Nullable and non-unique — see above. */
    nationalId: text('national_id'),

    /**
     * `nationalId` with NULL folded to the empty string, maintained by Postgres.
     *
     * Exists because NULLs never conflict with one another in a unique index, so
     * a unique index over `national_id` itself would let the two societies that
     * have no national ID re-insert on every import. Folding to '' inside the
     * index expression would work equally well in SQL, but Drizzle's
     * `onConflictDoUpdate` can only name columns as the conflict arbiter — so
     * the expression is materialised as a column instead.
     */
    nationalIdKey: text('national_id_key')
      .notNull()
      .generatedAlwaysAs(sql`coalesce(national_id, '')`),

    /** Display name, exactly as it appears in the source. */
    name: text('name').notNull(),

    /** `name` folded through `normalizeArabic()`. Half of the identity key. */
    nameNormalized: text('name_normalized').notNull(),

    /** لواء — administrative district within the governorate. */
    district: text('district').notNull(),

    /** التصنيف — activity classification. Absent for one source row. */
    classification: text('classification'),

    establishedAt: date('established_at'),

    /** Governing-board term. Absent for every row seeded from the Access export. */
    termStart: date('term_start'),

    /** Always `termStart` + `termLength` months, recomputed on every write — never user-entered directly. */
    termEnd: date('term_end'),

    /** Term length in months. */
    termLength: integer('term_length'),

    directorName: text('director_name'),

    /** Stored as text to preserve the leading zero. */
    mobile: text('mobile'),

    /** Board members stored as JSONB array. */
    members: jsonb('members').$type<Member[]>().default([]).notNull(),

    /** Row number from the source export, kept for reconciliation. */
    serialNo: integer('serial_no'),

    /**
     * Normalized haystack for quick search: name, director, district,
     * classification, and the digits of the ID and mobile. Backed by a trigram
     * index so substring matching stays indexable.
     */
    searchKey: text('search_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // Identity for the import's upsert: a society is the same society when its
    // national ID and its folded name both match.
    uniqueIndex('organizations_identity_key').on(table.nationalIdKey, table.nameNormalized),
    index('organizations_district_idx').on(table.district),
    index('organizations_classification_idx').on(table.classification),
    index('organizations_established_at_idx').on(table.establishedAt),
    index('organizations_national_id_idx').on(table.nationalId),
    index('organizations_term_start_idx').on(table.termStart),
    index('organizations_term_end_idx').on(table.termEnd)
  ]
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
