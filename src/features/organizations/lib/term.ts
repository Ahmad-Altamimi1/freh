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

/** `YYYY-MM-DD` for "today" in UTC — never read from local Date getters. */
export function todayUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}
