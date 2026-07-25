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
export function calculateTermEnd(termStart: string, termLengthMonths: number | ''): string {
  if (!termStart || termLengthMonths === '') return '';

  const [year, month, day] = termStart.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + termLengthMonths, day));
  return end.toISOString().slice(0, 10);
}
