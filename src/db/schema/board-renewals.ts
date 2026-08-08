import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

/**
 * The stages a board renewal passes through, in order.
 *
 * These are the directorate's actual procedure, not generic workflow states:
 * when a society's term lapses it must hold elections, and the directorate
 * notifies it, approves a date, sends an observer, then files the minutes
 * before the new board is recorded. The registry used to track only the fact
 * that a term had ended — everything between that and the updated roster
 * happened on paper.
 *
 * Order matters: `RENEWAL_STAGES.indexOf()` is what drives the board columns
 * and the "how far along" progress, so a new stage must be inserted at its
 * procedural position, not appended.
 */
export const RENEWAL_STAGES = [
  /** مستحقة — the term has lapsed (or is inside the notice window) and nothing has been done yet. */
  'due',
  /** أُشعِرت الجمعية — the directorate has formally notified the society. */
  'notified',
  /** موعد الانتخاب محدّد */
  'scheduled',
  /** مندوب معيّن — an observer from the directorate has been assigned. */
  'delegateAssigned',
  /** تم الانتخاب */
  'elected',
  /** المحضر مستلم — the election minutes have been filed. */
  'minutesReceived',
  /** المجلس محدّث — the new roster is in the registry. Terminal. */
  'boardUpdated'
] as const;

export type RenewalStage = (typeof RENEWAL_STAGES)[number];

/** The stage a renewal ends at. Reaching it is what closes the record. */
export const FINAL_RENEWAL_STAGE: RenewalStage = 'boardUpdated';

/** One entry per stage transition, appended on every move. */
export type RenewalStageEvent = {
  stage: RenewalStage;
  /** ISO timestamp of the transition. */
  at: string;
  /** Supabase `auth.users.id` of whoever moved it, or null for the opening entry. */
  actorId: string | null;
};

/**
 * Board-renewal tracking (تجديد الهيئة الإدارية).
 *
 * One row per (organization, term) — the piece of work that starts when a
 * governing-board term ends and finishes when the new board is recorded.
 *
 * Deliberately separate from `organizations` rather than a `renewal_stage`
 * column on it: a renewal is an episode with its own dates and history, and a
 * society has one per term. Folding it into the registry row would keep only
 * the latest and lose the previous cycle the moment the next one opened.
 */
export const boardRenewals = pgTable(
  'board_renewals',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    /**
     * The term this renewal closes — a snapshot of `organizations.term_end`
     * taken when the renewal opened.
     *
     * Snapshotted rather than joined because the registry's `term_end` moves
     * the moment the new term is entered, which is precisely the event that
     * completes this record. Reading it live would make every finished renewal
     * appear to belong to the term that came after it.
     */
    termEndAt: date('term_end_at').notNull(),

    /** Free-form discriminator constrained by a CHECK, same idiom as `notifications.status`. */
    stage: text('stage').notNull().default('due').$type<RenewalStage>(),

    /** موعد الانتخاب المقرر. Set from the `scheduled` stage onwards. */
    electionDate: date('election_date'),

    /** اسم مندوب المديرية المكلّف بحضور الانتخاب. */
    delegateName: text('delegate_name'),

    notes: text('notes'),

    /**
     * Every stage transition, appended in order.
     *
     * Denormalized JSONB rather than a child table, mirroring
     * `organizations.members` and `correspondences.files` — at this app's scale
     * the history is read only alongside its renewal and never queried across
     * rows, so a join table would buy nothing.
     */
    stageHistory: jsonb('stage_history').$type<RenewalStageEvent[]>().default([]).notNull(),

    /** Set when the renewal reaches `boardUpdated`. Null while it is open. */
    closedAt: timestamp('closed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // One renewal per term, and the conflict target the "open the due renewals"
    // sweep upserts against — running it twice must not open two records.
    uniqueIndex('board_renewals_organization_term_key').on(table.organizationId, table.termEndAt),
    index('board_renewals_stage_idx').on(table.stage),
    index('board_renewals_election_date_idx').on(table.electionDate),
    index('board_renewals_closed_at_idx').on(table.closedAt),
    check(
      'board_renewals_stage_check',
      sql`${table.stage} in ('due','notified','scheduled','delegateAssigned','elected','minutesReceived','boardUpdated')`
    )
  ]
);

export type BoardRenewalRow = typeof boardRenewals.$inferSelect;
export type NewBoardRenewalRow = typeof boardRenewals.$inferInsert;
