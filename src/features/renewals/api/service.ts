'use server';

import { and, asc, count, eq, isNotNull, isNull, lte, notExists, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  boardRenewals,
  FINAL_RENEWAL_STAGE,
  RENEWAL_STAGES,
  type RenewalStage,
  type RenewalStageEvent
} from '@/db/schema/board-renewals';
import { organizations } from '@/db/schema/organizations';
import { addDaysUTC, daysBetweenUTC, todayUTC } from '@/features/organizations/lib/term';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getServerEnv } from '@/lib/env';
import type {
  RenewalBoard,
  RenewalCard,
  RenewalDetailsPayload,
  RenewalStagePayload
} from './types';

// ============================================================
// Board Renewals Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle. `queries.ts` and every component import from here.
//
// The board has two sources, which is the one structural thing to know about
// this file: rows in `board_renewals`, plus organizations whose term has lapsed
// (or is inside the notice window) and that have no row yet. The second set is
// derived on every read rather than materialised by a sweep — see
// `getRenewalBoard` for why.
// ============================================================

const NO_READ_ACCESS = 'غير مصرح لك بالاطلاع على لوحة تجديد الهيئات.';
const NO_WRITE_ACCESS = 'غير مصرح لك بإدارة مسار التجديد.';

/** Columns every read of a renewal row needs, including the joined registry fields. */
const SELECT_COLUMNS = {
  id: boardRenewals.id,
  organizationId: boardRenewals.organizationId,
  organizationName: organizations.name,
  district: organizations.district,
  termEndAt: boardRenewals.termEndAt,
  stage: boardRenewals.stage,
  electionDate: boardRenewals.electionDate,
  delegateName: boardRenewals.delegateName,
  notes: boardRenewals.notes,
  members: organizations.members,
  stageHistory: boardRenewals.stageHistory
};

/**
 * The whole board: every open renewal, plus every society that is due one.
 *
 * The "مستحقة" column is derived from the registry rather than stored. A sweep
 * that materialised a row per due society would have to run somewhere (a cron,
 * or the first page load of the day), would leave orphaned rows behind whenever
 * a term-end date was corrected, and would make an untouched board indis-
 * tinguishable from a worked one. Deriving it means a row exists only once
 * somebody has actually done something, which is exactly what the history is
 * supposed to record.
 */
export async function getRenewalBoard(): Promise<RenewalBoard> {
  await requirePermission(PERMISSIONS.RENEWALS_READ, NO_READ_ACCESS);

  const db = getDb();
  const noticeDays = getServerEnv().TERM_END_NOTICE_DAYS;
  const today = todayUTC();
  const noticeEnd = addDaysUTC(today, noticeDays);

  const [openRows, dueRows, completed] = await Promise.all([
    db
      .select(SELECT_COLUMNS)
      .from(boardRenewals)
      .innerJoin(organizations, eq(boardRenewals.organizationId, organizations.id))
      .where(isNull(boardRenewals.closedAt))
      .orderBy(asc(boardRenewals.termEndAt), asc(organizations.name)),

    // Societies inside the notice window with no renewal record for the term
    // they are currently in. `notExists` rather than a left join so a society
    // with a *previous, closed* renewal still surfaces for its new term.
    db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        district: organizations.district,
        termEndAt: organizations.termEnd,
        members: organizations.members
      })
      .from(organizations)
      .where(
        and(
          isNotNull(organizations.termEnd),
          lte(organizations.termEnd, noticeEnd),
          notExists(
            db
              .select({ one: sql`1` })
              .from(boardRenewals)
              .where(
                and(
                  eq(boardRenewals.organizationId, organizations.id),
                  eq(boardRenewals.termEndAt, organizations.termEnd)
                )
              )
          )
        )
      )
      .orderBy(asc(organizations.termEnd), asc(organizations.name)),

    db.select({ value: count() }).from(boardRenewals).where(isNotNull(boardRenewals.closedAt))
  ]);

  const cards: RenewalCard[] = [
    ...openRows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      district: row.district,
      termEndAt: row.termEndAt,
      stage: row.stage,
      electionDate: row.electionDate,
      delegateName: row.delegateName,
      notes: row.notes,
      overdueDays: daysBetweenUTC(row.termEndAt, today),
      membersCount: row.members.length,
      stageHistory: row.stageHistory
    })),
    ...dueRows.map((row) => ({
      id: null,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      district: row.district,
      // Narrowed by the `isNotNull` predicate above; Drizzle types the column
      // from the schema, which does not know about the filter.
      termEndAt: row.termEndAt as string,
      stage: 'due' as RenewalStage,
      electionDate: null,
      delegateName: null,
      notes: null,
      overdueDays: daysBetweenUTC(row.termEndAt as string, today),
      membersCount: row.members.length,
      stageHistory: [] as RenewalStageEvent[]
    }))
  ];

  return {
    // Every stage gets a column even when empty — an absent column reads as
    // "this step does not exist" rather than "nothing is here right now".
    columns: RENEWAL_STAGES.map((stage) => ({
      stage,
      cards: cards
        .filter((card) => card.stage === stage)
        // Most overdue first: the board's job is to put the late ones on top.
        .toSorted((a, b) => b.overdueDays - a.overdueDays)
    })),
    completedCount: completed[0]?.value ?? 0,
    noticeDays,
    today
  };
}

/**
 * Confirms the (organization, term) pair a write names is a real one.
 *
 * `'use server'` makes every export here a POST endpoint, so the pair arrives
 * from the client and cannot be trusted. It is valid if a renewal already
 * exists for it, or if it is the organization's current term — anything else is
 * a fabricated key that would insert a renewal for a term that never was.
 */
async function assertRenewalTarget(organizationId: string, termEndAt: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: boardRenewals.id })
    .from(boardRenewals)
    .where(
      and(eq(boardRenewals.organizationId, organizationId), eq(boardRenewals.termEndAt, termEndAt))
    )
    .limit(1);
  if (existing) return;

  const [organization] = await db
    .select({ termEnd: organizations.termEnd })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) throw new Error('الجمعية غير موجودة.');
  if (organization.termEnd !== termEndAt) {
    throw new Error('دورة الجمعية تغيّرت — أعد تحميل الصفحة.');
  }
}

/**
 * Moves a renewal to a stage, opening the record if this is its first move.
 *
 * The upsert is what makes the derived "مستحقة" column work: acting on a card
 * that has no row writes one, and acting on a card that does appends to it. The
 * history is concatenated in SQL rather than read-modify-written in JavaScript,
 * so two people moving the same card cannot silently drop one another's entry.
 */
export async function setRenewalStage(
  payload: RenewalStagePayload
): Promise<{ stage: RenewalStage }> {
  const user = await requirePermission(PERMISSIONS.RENEWALS_MANAGE, NO_WRITE_ACCESS);

  const { organizationId, termEndAt, stage } = payload;
  if (!RENEWAL_STAGES.includes(stage)) {
    throw new Error('مرحلة غير معروفة.');
  }

  await assertRenewalTarget(organizationId, termEndAt);

  const event: RenewalStageEvent = {
    stage,
    at: new Date().toISOString(),
    actorId: user.id
  };
  const isFinal = stage === FINAL_RENEWAL_STAGE;

  await getDb()
    .insert(boardRenewals)
    .values({
      organizationId,
      termEndAt,
      stage,
      stageHistory: [event],
      closedAt: isFinal ? new Date() : null
    })
    .onConflictDoUpdate({
      target: [boardRenewals.organizationId, boardRenewals.termEndAt],
      set: {
        stage,
        stageHistory: sql`${boardRenewals.stageHistory} || ${JSON.stringify([event])}::jsonb`,
        // Moving back out of the final stage reopens the record, which is the
        // only way to correct a renewal closed by mistake.
        closedAt: isFinal ? sql`now()` : sql`null`,
        updatedAt: new Date()
      }
    });

  await auditLog({
    action: 'UPDATE',
    entityType: 'board_renewal',
    entityId: organizationId,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { termEndAt, stage }
  });

  return { stage };
}

/**
 * Records the dates and people on a renewal.
 *
 * Upserts for the same reason `setRenewalStage` does — filling in an election
 * date is a legitimate first action on a card that has no row yet. Undefined
 * keys are left alone; an explicit null clears the field.
 */
export async function updateRenewalDetails(payload: RenewalDetailsPayload): Promise<void> {
  const user = await requirePermission(PERMISSIONS.RENEWALS_MANAGE, NO_WRITE_ACCESS);

  const { organizationId, termEndAt, electionDate, delegateName, notes } = payload;
  await assertRenewalTarget(organizationId, termEndAt);

  const changes = {
    ...(electionDate !== undefined && { electionDate: electionDate || null }),
    ...(delegateName !== undefined && { delegateName: delegateName?.trim() || null }),
    ...(notes !== undefined && { notes: notes?.trim() || null })
  };

  await getDb()
    .insert(boardRenewals)
    .values({ organizationId, termEndAt, stage: 'due', stageHistory: [], ...changes })
    .onConflictDoUpdate({
      target: [boardRenewals.organizationId, boardRenewals.termEndAt],
      set: { ...changes, updatedAt: new Date() }
    });

  await auditLog({
    action: 'UPDATE',
    entityType: 'board_renewal',
    entityId: organizationId,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { termEndAt, fields: Object.keys(changes) }
  });
}
