/**
 * `termEnd` is never entered directly — it is always `termStart` + `termLength`
 * months, recomputed wherever it's needed so the form's preview and the
 * server's write can never disagree.
 *
 * Deliberately avoids `date-fns`'s `addMonths` on a `new Date('YYYY-MM-DD')`:
 * that constructor parses as UTC midnight, but `addMonths` reads it back with
 * *local* getters — the same local/UTC mismatch `established_at` imports
 * already had to work around. Plain `Date.UTC` integer math sidesteps it
 * regardless of the server's timezone.
 */

/** `YYYY-MM-DD` plus `months`, computed via `Date.UTC` integer math. */
function addMonthsUTC(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` plus `days`, computed via `Date.UTC` integer math. */
export function addDaysUTC(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function calculateTermEnd(termStart: string, termLengthMonths: number | ''): string {
  if (!termStart || termLengthMonths === '') return '';
  return addMonthsUTC(termStart, termLengthMonths);
}

/**
 * Whole days from `fromISO` to `toISO`, positive when `to` is later.
 *
 * `Date.UTC` integer math for the same reason the rest of this module avoids
 * `Date` arithmetic: both operands are calendar dates, and any path through
 * local getters shifts the answer by a day around midnight.
 */
export function daysBetweenUTC(fromISO: string, toISO: string): number {
  const [fromYear, fromMonth, fromDay] = fromISO.split('-').map(Number);
  const [toYear, toMonth, toDay] = toISO.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86_400_000);
}

/** The buckets `term_end` falls into, relative to today. */
export type TermStatus = 'active' | 'endingSoon' | 'ended' | 'unset';

/**
 * Buckets one `term_end` the same way the dashboard's SQL does.
 *
 * The thresholds are passed in rather than read here so a caller cannot end up
 * classifying against a different "today" than the rest of its page — and
 * because `TERM_END_NOTICE_DAYS` is server-only env, which this module is not.
 * String comparison is safe and intended: `YYYY-MM-DD` sorts lexicographically
 * in date order, which is exactly why the schema stores dates in that shape.
 */
export function termStatusOf(termEnd: string | null, today: string, noticeEnd: string): TermStatus {
  if (!termEnd) return 'unset';
  if (termEnd < today) return 'ended';
  if (termEnd <= noticeEnd) return 'endingSoon';
  return 'active';
}

/** `YYYY-MM-DD` for "today" in UTC — never read from local Date getters. */
export function todayUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}
