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

/** A row's classification once it has a `term_end`. */
export type TermRemainingBucket = 'expired' | 'lt_2mo' | 'lt_3mo' | 'lt_6mo' | 'lt_1yr' | 'gt_1yr';

/** A filter value: every bucket, plus `'all'` — any organization with a `term_end` set. */
export type TermRemainingFilter = 'all' | TermRemainingBucket;

export const TERM_REMAINING_FILTER_VALUES = [
  'all',
  'expired',
  'lt_2mo',
  'lt_3mo',
  'lt_6mo',
  'lt_1yr',
  'gt_1yr'
] as const satisfies readonly TermRemainingFilter[];

type TermBucketCutoffs = {
  today: string;
  cutoff2mo: string;
  cutoff3mo: string;
  cutoff6mo: string;
  cutoff1yr: string;
};

/**
 * Calendar-month cutoffs the "time remaining" buckets are drawn from, all
 * anchored to the same `today` so a row's bucket (computed client-side for
 * display) and the query's `WHERE` clause (computed server-side) can never
 * disagree by more than the two evaluating on different days.
 */
export function getTermBucketCutoffs(today: string = todayUTC()): TermBucketCutoffs {
  return {
    today,
    cutoff2mo: addMonthsUTC(today, 2),
    cutoff3mo: addMonthsUTC(today, 3),
    cutoff6mo: addMonthsUTC(today, 6),
    cutoff1yr: addMonthsUTC(today, 12)
  };
}

/** Which bucket a given `term_end` falls into, relative to `cutoffs`. */
export function getTermRemainingBucket(
  termEnd: string,
  cutoffs: TermBucketCutoffs = getTermBucketCutoffs()
): TermRemainingBucket {
  if (termEnd < cutoffs.today) return 'expired';
  if (termEnd < cutoffs.cutoff2mo) return 'lt_2mo';
  if (termEnd < cutoffs.cutoff3mo) return 'lt_3mo';
  if (termEnd < cutoffs.cutoff6mo) return 'lt_6mo';
  if (termEnd < cutoffs.cutoff1yr) return 'lt_1yr';
  return 'gt_1yr';
}

/** `{ gte, lt }` bounds for one bucket, as `YYYY-MM-DD` strings (either may be absent at the open end). */
export function getTermRemainingBucketRange(
  bucket: TermRemainingBucket,
  cutoffs: TermBucketCutoffs = getTermBucketCutoffs()
): { gte?: string; lt?: string } {
  switch (bucket) {
    case 'expired':
      return { lt: cutoffs.today };
    case 'lt_2mo':
      return { gte: cutoffs.today, lt: cutoffs.cutoff2mo };
    case 'lt_3mo':
      return { gte: cutoffs.cutoff2mo, lt: cutoffs.cutoff3mo };
    case 'lt_6mo':
      return { gte: cutoffs.cutoff3mo, lt: cutoffs.cutoff6mo };
    case 'lt_1yr':
      return { gte: cutoffs.cutoff6mo, lt: cutoffs.cutoff1yr };
    case 'gt_1yr':
      return { gte: cutoffs.cutoff1yr };
  }
}
