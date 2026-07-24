export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch {
    return '';
  }
}

/**
 * Arabic date formatting for Jordan.
 *
 * The locale is pinned to three explicit choices:
 *
 *  - `ca-gregory` — these are civil registration dates recorded on the Gregorian
 *    calendar. `ar-JO` would otherwise be free to render them as Hijri, which
 *    would not be a translation but a different date.
 *  - `nu-latn` — Western digits. The rest of the record (national IDs, phone
 *    numbers) is Latin-digit, and mixing numeral systems in one table makes
 *    dates hard to scan and impossible to compare by eye.
 *  - Arabic month names, which is the part that should be translated.
 *
 * A bare `YYYY-MM-DD` string is read as UTC by `new Date`, which is what the
 * `date` column stores — no timezone shift is introduced here.
 */
export function formatDateAr(
  date: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('ar-JO-u-ca-gregory-nu-latn', {
      day: opts.day ?? 'numeric',
      month: opts.month ?? 'long',
      year: opts.year ?? 'numeric',
      timeZone: opts.timeZone ?? 'UTC',
      ...opts
    }).format(new Date(date));
  } catch {
    return '';
  }
}

/** Formats an integer with Arabic thousands grouping but Western digits. */
export function formatNumberAr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('ar-JO-u-nu-latn').format(value);
}

/** Renders `part / total` as a whole-number percentage. Guards a zero total. */
export function formatPercent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}
