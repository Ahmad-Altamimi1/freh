'use server';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lt,
  ne,
  sql,
  type SQL
} from 'drizzle-orm';

import { getDb } from '@/db';
import { organizations } from '@/db/schema/organizations';
import { calculateTermEnd, getTermBucketCutoffs, getTermRemainingBucketRange } from '../lib/term';
import { buildSearchKey, normalizeArabic } from '@/lib/arabic';
import { auditLog } from '@/lib/audit';
import { hasAnyRole } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';
import { buildFilterWhere, escapeLike, type FilterableColumns } from '@/lib/filter-columns';
import type {
  Organization,
  OrganizationFacets,
  OrganizationFilters,
  OrganizationMutationPayload,
  OrganizationReport,
  OrganizationsResponse,
  OrganizationTermBucketCounts
} from './types';

// ============================================================
// Organizations Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle. This is the only file in the feature that touches
// the database; `queries.ts` and every component import from here.
//
// Two rules hold throughout:
//   1. `requireUser()` runs before any query. Every export here is reachable as
//      a POST endpoint because of `'use server'`, so the proxy redirect is not
//      a boundary — this is.
//   2. Filtering, counting, sorting and aggregation all happen in Postgres
//      behind one shared `WHERE`. A report and the table it came from must
//      describe the same rows, and that only holds if they share the predicate.
// ============================================================

/** Columns the advanced filter is allowed to reach. */
const FILTERABLE_COLUMNS: FilterableColumns = {
  name: organizations.name,
  district: organizations.district,
  classification: organizations.classification,
  nationalId: organizations.nationalId,
  establishedAt: organizations.establishedAt,
  termStart: organizations.termStart,
  termEnd: organizations.termEnd,
  termLength: organizations.termLength,
  directorName: organizations.directorName,
  mobile: organizations.mobile,
  serialNo: organizations.serialNo
};

/** Columns the table is allowed to sort by. */
const SORTABLE_COLUMNS = FILTERABLE_COLUMNS;

/** The public column list — everything except the derived matching columns. */
const SELECT_COLUMNS = {
  id: organizations.id,
  nationalId: organizations.nationalId,
  name: organizations.name,
  district: organizations.district,
  classification: organizations.classification,
  establishedAt: organizations.establishedAt,
  termStart: organizations.termStart,
  termEnd: organizations.termEnd,
  termLength: organizations.termLength,
  directorName: organizations.directorName,
  mobile: organizations.mobile,
  serialNo: organizations.serialNo,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt
};

/**
 * The single predicate shared by the listing, the facets, the report and the
 * export.
 *
 * Quick search is ANDed with the advanced filters regardless of the filters'
 * own join operator: typing in the search box should always narrow what is on
 * screen, never widen it, which is what OR-ing it in would do.
 */
function buildWhere(filters: OrganizationFilters): SQL | undefined {
  const conditions: SQL[] = [];

  const query = normalizeArabic(filters.q);
  if (query) {
    conditions.push(ilike(organizations.searchKey, `%${escapeLike(query)}%`));
  }

  const advanced = buildFilterWhere({
    columns: FILTERABLE_COLUMNS,
    filters: filters.filters ?? [],
    joinOperator: filters.joinOperator ?? 'and'
  });
  if (advanced) conditions.push(advanced);

  // Only the term-ending-soon page ever sets this — the main listing omits it
  // entirely, so this never narrows a query that didn't ask for it.
  if (filters.remainingBucket) {
    conditions.push(isNotNull(organizations.termEnd));
    if (filters.remainingBucket !== 'all') {
      const range = getTermRemainingBucketRange(filters.remainingBucket);
      if (range.gte) conditions.push(gte(organizations.termEnd, range.gte));
      if (range.lt) conditions.push(lt(organizations.termEnd, range.lt));
    }
  }

  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function buildOrderBy(filters: OrganizationFilters) {
  const sorting = filters.sort ?? [];

  const clauses = sorting
    .map((item) => {
      const column = SORTABLE_COLUMNS[item.id as string];
      if (!column) return undefined;
      return item.desc ? desc(column) : asc(column);
    })
    .filter((clause) => clause !== undefined);

  // A deterministic tiebreaker. Without one, Postgres may return rows in a
  // different order between pages of an otherwise-equal sort, which shows up as
  // rows appearing twice or not at all while paging.
  return clauses.length > 0
    ? [...clauses, asc(organizations.id)]
    : [asc(organizations.serialNo), asc(organizations.id)];
}

export async function getOrganizations(
  filters: OrganizationFilters
): Promise<OrganizationsResponse> {
  await requireUser();

  const db = getDb();
  const where = buildWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 10));

  const [rows, totals] = await Promise.all([
    db
      .select(SELECT_COLUMNS)
      .from(organizations)
      .where(where)
      .orderBy(...buildOrderBy(filters))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ value: count() }).from(organizations).where(where)
  ]);

  const total = totals[0]?.value ?? 0;

  return {
    data: rows,
    total,
    pageCount: Math.ceil(total / perPage)
  };
}

/** Every row matching the filter, unpaginated. Backs the export and the report table. */
export async function getAllOrganizations(filters: OrganizationFilters) {
  await requireUser();

  return getDb()
    .select(SELECT_COLUMNS)
    .from(organizations)
    .where(buildWhere(filters))
    .orderBy(...buildOrderBy(filters));
}

/**
 * Distinct district and classification values with their counts.
 *
 * Read from the data rather than a hardcoded list, so a value that appears in a
 * later import becomes filterable without a code change.
 */
export async function getOrganizationFacets(
  filters: OrganizationFilters = {}
): Promise<OrganizationFacets> {
  await requireUser();

  const db = getDb();
  const where = buildWhere(filters);

  const [districts, classifications] = await Promise.all([
    db
      .select({ value: organizations.district, count: count() })
      .from(organizations)
      .where(where)
      .groupBy(organizations.district)
      .orderBy(desc(count()), asc(organizations.district)),
    db
      .select({ value: organizations.classification, count: count() })
      .from(organizations)
      .where(
        and(where, isNotNull(organizations.classification), ne(organizations.classification, ''))
      )
      .groupBy(organizations.classification)
      .orderBy(desc(count()), asc(organizations.classification))
  ]);

  return {
    districts: districts.filter((row) => Boolean(row.value)) as OrganizationFacets['districts'],
    classifications: classifications.filter((row) =>
      Boolean(row.value)
    ) as OrganizationFacets['classifications']
  };
}

/**
 * Counts per "time remaining" bucket, for the tabs on the term-ending-soon
 * page. Takes the same quick-search/advanced-filter state as the table it sits
 * above — excluding `remainingBucket` itself, since the point is to show how
 * many rows fall in *each* bucket under whatever else is currently filtered.
 *
 * One query with conditional aggregates, same style as `getOrganizationReport`,
 * rather than one query per bucket.
 */
export async function getOrganizationTermBucketCounts(
  filters: OrganizationFilters
): Promise<OrganizationTermBucketCounts> {
  await requireUser();

  const db = getDb();
  const where = buildWhere({ ...filters, remainingBucket: undefined });
  const termEnd = organizations.termEnd;
  const cutoffs = getTermBucketCutoffs();

  const notNull = isNotNull(termEnd);
  const scopedWhere = where ? and(where, notNull) : notNull;

  const [row] = await db
    .select({
      all: count(),
      expired: sql<number>`count(*) filter (where ${termEnd} < ${cutoffs.today})::int`,
      lt_2mo: sql<number>`count(*) filter (where ${termEnd} >= ${cutoffs.today} and ${termEnd} < ${cutoffs.cutoff2mo})::int`,
      lt_3mo: sql<number>`count(*) filter (where ${termEnd} >= ${cutoffs.cutoff2mo} and ${termEnd} < ${cutoffs.cutoff3mo})::int`,
      lt_6mo: sql<number>`count(*) filter (where ${termEnd} >= ${cutoffs.cutoff3mo} and ${termEnd} < ${cutoffs.cutoff6mo})::int`,
      lt_1yr: sql<number>`count(*) filter (where ${termEnd} >= ${cutoffs.cutoff6mo} and ${termEnd} < ${cutoffs.cutoff1yr})::int`,
      gt_1yr: sql<number>`count(*) filter (where ${termEnd} >= ${cutoffs.cutoff1yr})::int`
    })
    .from(organizations)
    .where(scopedWhere);

  return {
    all: row?.all ?? 0,
    expired: row?.expired ?? 0,
    lt_2mo: row?.lt_2mo ?? 0,
    lt_3mo: row?.lt_3mo ?? 0,
    lt_6mo: row?.lt_6mo ?? 0,
    lt_1yr: row?.lt_1yr ?? 0,
    gt_1yr: row?.gt_1yr ?? 0
  };
}

/**
 * Aggregates for the report, all behind the same `WHERE` as the table.
 *
 * Computed by Postgres rather than by counting fetched rows — a report that
 * summarised only the current page would be quietly wrong.
 */
export async function getOrganizationReport(
  filters: OrganizationFilters
): Promise<OrganizationReport> {
  await requireUser();

  const db = getDb();
  const where = buildWhere(filters);
  const establishedYear = sql<number>`extract(year from ${organizations.establishedAt})::int`;

  const [summaryRows, byDistrict, byClassification, byYear] = await Promise.all([
    db
      .select({
        total: count(),
        districtCount: sql<number>`count(distinct ${organizations.district})::int`,
        classificationCount: sql<number>`count(distinct ${organizations.classification})::int`,
        withMobile: sql<number>`count(*) filter (where ${organizations.mobile} is not null and ${organizations.mobile} <> '')::int`,
        withDirector: sql<number>`count(*) filter (where ${organizations.directorName} is not null and ${organizations.directorName} <> '')::int`,
        earliestYear: sql<
          number | null
        >`min(extract(year from ${organizations.establishedAt}))::int`,
        latestYear: sql<number | null>`max(extract(year from ${organizations.establishedAt}))::int`
      })
      .from(organizations)
      .where(where),
    db
      .select({ label: organizations.district, count: count() })
      .from(organizations)
      .where(where)
      .groupBy(organizations.district)
      .orderBy(desc(count())),
    db
      .select({ label: organizations.classification, count: count() })
      .from(organizations)
      .where(where)
      .groupBy(organizations.classification)
      .orderBy(desc(count())),
    db
      .select({ year: establishedYear, count: count() })
      .from(organizations)
      .where(and(where, isNotNull(organizations.establishedAt)))
      .groupBy(establishedYear)
      .orderBy(asc(establishedYear))
  ]);

  const summary = summaryRows[0];

  return {
    summary: {
      total: summary?.total ?? 0,
      districtCount: summary?.districtCount ?? 0,
      classificationCount: summary?.classificationCount ?? 0,
      withMobile: summary?.withMobile ?? 0,
      withDirector: summary?.withDirector ?? 0,
      earliestYear: summary?.earliestYear ?? null,
      latestYear: summary?.latestYear ?? null
    },
    // A missing classification is a real category in this data — one row has
    // none — so it is labelled rather than dropped.
    byDistrict: byDistrict.map((row) => ({ label: row.label ?? '—', count: row.count })),
    byClassification: byClassification.map((row) => ({
      label: row.label ?? 'غير مصنّف',
      count: row.count
    })),
    byYear: byYear.map((row) => ({ year: row.year, count: row.count }))
  };
}

// ============================================================
// Writes
// ============================================================
// All three require the `admin` role. `'use server'` makes every export in this
// file a POST endpoint, so hiding a button in the UI guards nothing — this is
// the check that does.
//
// `nameNormalized` and `searchKey` are derived on every write through the same
// `@/lib/arabic` helpers the import uses. A row written here that skipped them
// would be invisible to search and invisible to the import's duplicate
// detection, which is a silent failure rather than a loud one.
// ============================================================

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';

async function requireEditor() {
  const user = await requireUser();
  if (!hasAnyRole(user, ['admin'])) {
    throw new Error('غير مصرح لك بتعديل السجل.');
  }
  return user;
}

/** Blank strings from the form become NULL, so "unset" is one value in the database. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Maps form values onto the columns, including the derived ones. */
function toWriteValues(input: OrganizationMutationPayload) {
  const row = {
    name: input.name.trim(),
    district: input.district.trim(),
    classification: blankToNull(input.classification),
    nationalId: blankToNull(input.nationalId),
    establishedAt: blankToNull(input.establishedAt),
    termStart: blankToNull(input.termStart),
    termLength: input.termLength === '' ? null : input.termLength,
    // Always recomputed here, never taken from the client — see the comment
    // on `OrganizationMutationPayload`, which has no `termEnd` field at all.
    termEnd: calculateTermEnd(input.termStart, input.termLength) || null,
    directorName: blankToNull(input.directorName),
    mobile: blankToNull(input.mobile)
  };

  return {
    ...row,
    nameNormalized: normalizeArabic(row.name),
    searchKey: buildSearchKey(row)
  };
}

/**
 * Rethrows a unique-index violation as something a user can act on.
 *
 * The index covers `(national_id_key, name_normalized)`, and the normalization
 * means the clash is often invisible in the raw text — "جمعية الشعلة" and
 * "جمعيه الشعله" collide. Saying which pair collided is the difference between
 * a fixable message and a mystery.
 */
function rethrowWriteError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new Error('توجد جمعية أخرى بنفس الاسم والرقم الوطني.');
    }
  }
  throw error;
}

export async function createOrganization(
  input: OrganizationMutationPayload
): Promise<Organization> {
  const user = await requireEditor();

  try {
    const [created] = await getDb()
      .insert(organizations)
      .values(toWriteValues(input))
      .returning(SELECT_COLUMNS);

    await auditLog({
      action: 'CREATE',
      entityType: 'organization',
      entityId: created.id,
      actor: { id: user.id, email: user.email, type: 'user' },
      metadata: { name: created.name, district: created.district }
    });

    return created;
  } catch (error) {
    rethrowWriteError(error);
  }
}

export async function updateOrganization(
  id: string,
  input: OrganizationMutationPayload
): Promise<Organization> {
  const user = await requireEditor();

  try {
    const [updated] = await getDb()
      .update(organizations)
      .set({ ...toWriteValues(input), updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning(SELECT_COLUMNS);

    if (!updated) throw new Error('الجمعية غير موجودة.');

    await auditLog({
      action: 'UPDATE',
      entityType: 'organization',
      entityId: updated.id,
      actor: { id: user.id, email: user.email, type: 'user' },
      metadata: { name: updated.name, district: updated.district }
    });

    return updated;
  } catch (error) {
    rethrowWriteError(error);
  }
}

export async function deleteOrganization(id: string): Promise<{ id: string }> {
  const user = await requireEditor();

  const [deleted] = await getDb()
    .delete(organizations)
    .where(eq(organizations.id, id))
    .returning({ id: organizations.id, name: organizations.name });

  if (!deleted) throw new Error('الجمعية غير موجودة.');

  await auditLog({
    action: 'DELETE',
    entityType: 'organization',
    entityId: deleted.id,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { name: deleted.name }
  });

  return { id: deleted.id };
}
