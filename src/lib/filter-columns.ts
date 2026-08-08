import {
  and,
  between,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notIlike,
  notInArray,
  or,
  type Column,
  type SQL
} from 'drizzle-orm';
import { endOfDay, startOfDay, startOfMonth, startOfYear, subDays } from 'date-fns';

import { getValidFilters } from '@/lib/data-table';
import type { ExtendedColumnFilter, JoinOperator } from '@/types/data-table';

/**
 * Translates the URL-encoded filter state produced by the advanced filter
 * builder into a Drizzle `WHERE` clause.
 *
 * This is the piece that makes filtering real. Without it the table could only
 * filter the rows already fetched for the current page, so counts, sorting, and
 * reports would all describe a single page rather than the whole result set.
 *
 * Everything here treats its input as hostile: filter state arrives from the
 * query string, so a column id is only honoured when it appears in the
 * caller-supplied `columns` map, and a value that will not coerce is dropped
 * rather than interpolated. Values reach Postgres as bound parameters via
 * Drizzle's operators — never string-concatenated into SQL.
 */

/** The columns a caller is willing to expose to filtering, keyed by filter id. */
export type FilterableColumns = Record<string, Column>;

/**
 * Relative-date tokens the `isRelativeToToday` operator understands. The filter
 * builder emits exactly these strings.
 */
export const RELATIVE_DATE_TOKENS = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'last90',
  'thisMonth',
  'thisYear'
] as const;

export type RelativeDateToken = (typeof RELATIVE_DATE_TOKENS)[number];

function isRelativeDateToken(value: string): value is RelativeDateToken {
  return (RELATIVE_DATE_TOKENS as readonly string[]).includes(value);
}

/** Formats a Date as `YYYY-MM-DD` in UTC. */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Coerces a filter value to a `YYYY-MM-DD` string.
 *
 * The date picker emits epoch milliseconds as a string; a URL edited by hand may
 * carry an ISO date. Both are read in UTC — going through the local timezone
 * would shift a date across a day boundary for anyone east or west of GMT, and
 * these are calendar dates with no time component.
 */
function toDateValue(value: string): string | null {
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const parsed = new Date(Number(value));
    return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
}

function toNumberValue(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Resolves a relative token to an inclusive `[from, to]` pair of ISO dates. */
function resolveRelativeRange(token: RelativeDateToken): [string, string] {
  const now = new Date();
  const today = startOfDay(now);
  const end = endOfDay(now);

  switch (token) {
    case 'today':
      return [toIsoDate(today), toIsoDate(end)];
    case 'yesterday': {
      const yesterday = subDays(today, 1);
      return [toIsoDate(yesterday), toIsoDate(yesterday)];
    }
    case 'last7':
      return [toIsoDate(subDays(today, 6)), toIsoDate(end)];
    case 'last30':
      return [toIsoDate(subDays(today, 29)), toIsoDate(end)];
    case 'last90':
      return [toIsoDate(subDays(today, 89)), toIsoDate(end)];
    case 'thisMonth':
      return [toIsoDate(startOfMonth(now)), toIsoDate(end)];
    case 'thisYear':
      return [toIsoDate(startOfYear(now)), toIsoDate(end)];
  }
}

/**
 * True for columns where the empty string is a real value and `LIKE` is legal.
 *
 * `dataType` alone is not enough. Drizzle reports `date`, `uuid` and friends as
 * `'string'` because that is how they surface in TypeScript, but Postgres will
 * not compare either one to `''` or match it against a pattern — it raises an
 * invalid-input error rather than returning false. Checking the SQL type keeps
 * an "is empty" filter on a date column to a plain NULL test.
 */
const STRING_SQL_TYPES = /^(text|varchar|char|citext)/;

function isTextColumn(column: Column): boolean {
  return column.dataType === 'string' && STRING_SQL_TYPES.test(column.getSQLType());
}

/**
 * Normalizes a filter value to the scalar the column's variant expects.
 * Returns `undefined` when the value cannot be coerced, which drops the filter.
 */
function coerceScalar(
  filter: ExtendedColumnFilter<unknown>,
  raw: string
): string | number | undefined {
  switch (filter.variant) {
    case 'date':
    case 'dateRange':
      return toDateValue(raw) ?? undefined;
    case 'number':
    case 'range':
      return toNumberValue(raw) ?? undefined;
    default:
      return raw;
  }
}

/** Reads a filter's value as an array, tolerating the single-value form. */
function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Builds the condition for one filter. Returns `undefined` when the filter
 * cannot be expressed — an unusable value, or an operator/variant mismatch —
 * so a malformed condition narrows nothing instead of erroring the page.
 */
function buildCondition(column: Column, filter: ExtendedColumnFilter<unknown>): SQL | undefined {
  const { operator, value } = filter;

  // Presence checks ignore `value` entirely.
  if (operator === 'isEmpty') {
    return isTextColumn(column) ? or(isNull(column), eq(column, '')) : isNull(column);
  }
  if (operator === 'isNotEmpty') {
    return isTextColumn(column) ? and(isNotNull(column), ne(column, '')) : isNotNull(column);
  }

  if (operator === 'inArray' || operator === 'notInArray') {
    const values = toArray(value).filter(Boolean);
    if (values.length === 0) return undefined;
    return operator === 'inArray' ? inArray(column, values) : notInArray(column, values);
  }

  if (operator === 'isBetween') {
    const [rawFrom, rawTo] = toArray(value);
    const from = rawFrom ? coerceScalar(filter, rawFrom) : undefined;
    const to = rawTo ? coerceScalar(filter, rawTo) : undefined;

    // A half-open range is meaningful — treat it as a one-sided comparison
    // rather than discarding what the user did specify.
    if (from !== undefined && to !== undefined) return between(column, from, to);
    if (from !== undefined) return gte(column, from);
    if (to !== undefined) return lte(column, to);
    return undefined;
  }

  if (operator === 'isRelativeToToday') {
    const token = toArray(value)[0];
    if (!token || !isRelativeDateToken(token)) return undefined;
    const [from, to] = resolveRelativeRange(token);
    return between(column, from, to);
  }

  const raw = toArray(value)[0];
  if (raw === undefined) return undefined;

  const scalar = coerceScalar(filter, raw);
  if (scalar === undefined) return undefined;

  switch (operator) {
    case 'iLike':
      // Escape the LIKE metacharacters so a literal % or _ in a search term
      // matches itself rather than acting as a wildcard.
      return isTextColumn(column) ? ilike(column, `%${escapeLike(String(scalar))}%`) : undefined;
    case 'notILike':
      return isTextColumn(column) ? notIlike(column, `%${escapeLike(String(scalar))}%`) : undefined;
    case 'eq':
      return eq(column, scalar);
    case 'ne':
      return ne(column, scalar);
    case 'lt':
      return lt(column, scalar);
    case 'lte':
      return lte(column, scalar);
    case 'gt':
      return gt(column, scalar);
    case 'gte':
      return gte(column, scalar);
    default:
      return undefined;
  }
}

/** Escapes `%`, `_` and `\` so they are matched literally inside a LIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Combines the advanced filter state into a single `WHERE` clause.
 *
 * Returns `undefined` when nothing valid remains, which callers should treat as
 * "no filtering" rather than "match nothing".
 */
export function buildFilterWhere<TData>({
  columns,
  filters,
  joinOperator = 'and'
}: {
  columns: FilterableColumns;
  filters: ExtendedColumnFilter<TData>[];
  joinOperator?: JoinOperator;
}): SQL | undefined {
  const conditions = getValidFilters(filters)
    .map((filter) => {
      const column = columns[filter.id as string];
      // Unknown id — a stale link or a hand-edited query string. Ignore it
      // rather than trusting arbitrary input to name a column.
      if (!column) return undefined;
      return buildCondition(column, filter as ExtendedColumnFilter<unknown>);
    })
    .filter((condition): condition is SQL => condition !== undefined);

  if (conditions.length === 0) return undefined;

  return joinOperator === 'or' ? or(...conditions) : and(...conditions);
}
