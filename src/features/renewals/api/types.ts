import { FINAL_RENEWAL_STAGE, RENEWAL_STAGES } from '@/db/schema/board-renewals';
import type { RenewalStage, RenewalStageEvent } from '@/db/schema/board-renewals';

export { FINAL_RENEWAL_STAGE, RENEWAL_STAGES };
export type { RenewalStage, RenewalStageEvent };

/**
 * One society's position in the renewal cycle, as the board renders it.
 *
 * `id` is null for a society that is due but has no renewal record yet. The
 * board shows those in the first column derived straight from the registry —
 * a row is written the moment someone acts on the card, so a directorate that
 * never opens the page accumulates no empty rows, and a society whose term end
 * is corrected simply moves rather than leaving a stale record behind.
 */
export type RenewalCard = {
  id: string | null;
  organizationId: string;
  organizationName: string;
  district: string;
  /** `YYYY-MM-DD` — the term this renewal closes. */
  termEndAt: string;
  stage: RenewalStage;
  electionDate: string | null;
  delegateName: string | null;
  notes: string | null;
  /**
   * Days since the term ended. Negative while the term is still running, which
   * is how a card inside the notice window is distinguished from a late one.
   */
  overdueDays: number;
  /** Board size on record, so "المجلس محدّث" can be judged at a glance. */
  membersCount: number;
  stageHistory: RenewalStageEvent[];
};

export type RenewalColumn = {
  stage: RenewalStage;
  cards: RenewalCard[];
};

export type RenewalBoard = {
  columns: RenewalColumn[];
  /** Renewals already completed, counted rather than listed. */
  completedCount: number;
  /** The notice window in days — the same one the alerts and the report use. */
  noticeDays: number;
  /** `YYYY-MM-DD` in UTC, so the client never re-derives "today" in local time. */
  today: string;
};

/** Moving a card. The renewal is addressed by (organization, term), not by id. */
export type RenewalStagePayload = {
  organizationId: string;
  termEndAt: string;
  stage: RenewalStage;
};

/** Editing a card's dates and people. Only supplied keys are written. */
export type RenewalDetailsPayload = {
  organizationId: string;
  termEndAt: string;
  electionDate?: string | null;
  delegateName?: string | null;
  notes?: string | null;
};
