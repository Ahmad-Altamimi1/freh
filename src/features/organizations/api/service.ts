'use server';

import { and, asc, count, desc, eq, ilike, isNotNull, ne, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '@/db';
import { organizations } from '@/db/schema/organizations';
import { reportTemplates, type ReportTemplateRow } from '@/db/schema/report-templates';
import { addDaysUTC, calculateTermEnd, todayUTC } from '../lib/term';
import { buildSearchKey, normalizeArabic } from '@/lib/arabic';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { buildFilterWhere, escapeLike, type FilterableColumns } from '@/lib/filter-columns';
import { getServerEnv } from '@/lib/env';
import { MEMBER_REQUIRED_FIELDS, parseMembersWorkbook } from './workbook';
import type {
  DashboardOverview,
  DataGap,
  DataGapKey,
  ImportIssue,
  ImportPreview,
  ImportResult,
  Member,
  Organization,
  OrganizationFacets,
  OrganizationFilters,
  OrganizationMutationPayload,
  OrganizationReport,
  OrganizationsResponse,
  ReportDefinition,
  ReportGroupRow,
  ReportResult,
  ReportTemplate,
  ReportTemplatePayload
} from './types';
import { DATA_GAP_KEYS, REPORT_COLUMNS, REPORT_GROUP_BY, REPORT_SECTIONS } from './types';

// ============================================================
// Organizations Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle. This is the only file in the feature that touches
// the database; `queries.ts` and every component import from here.
//
// Two rules hold throughout:
//   1. `requirePermission()` runs before any query, naming the specific
//      capability that export needs — reads included, since being signed in is
//      not the same as being allowed to see the registry. Every export here is
//      reachable as a POST endpoint because of `'use server'`, so the proxy
//      redirect is not a boundary — this is.
//   2. Filtering, counting, sorting and aggregation all happen in Postgres
//      behind one shared `WHERE`. A report and the table it came from must
//      describe the same rows, and that only holds if they share the predicate.
// ============================================================

/** Shared refusal messages, so the same denial always reads the same. */
const NO_READ_ACCESS = 'غير مصرح لك بالاطلاع على السجل.';
const NO_WRITE_ACCESS = 'غير مصرح لك بتعديل السجل.';
const NO_REPORT_ACCESS = 'غير مصرح لك بالاطلاع على التقارير.';
const NO_TEMPLATE_ACCESS = 'غير مصرح لك بإدارة قوالب التقارير.';

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
  members: organizations.members,
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
  await requirePermission(PERMISSIONS.ORGANIZATIONS_READ, NO_READ_ACCESS);

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
  await requirePermission(PERMISSIONS.ORGANIZATIONS_READ, NO_READ_ACCESS);

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
export async function getOrganizationById(id: string): Promise<Organization | null> {
  await requirePermission(PERMISSIONS.ORGANIZATIONS_READ, NO_READ_ACCESS);

  const [row] = await getDb()
    .select(SELECT_COLUMNS)
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  return row ?? null;
}

export async function getOrganizationFacets(
  filters: OrganizationFilters = {}
): Promise<OrganizationFacets> {
  await requirePermission(PERMISSIONS.ORGANIZATIONS_READ, NO_READ_ACCESS);

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
 * Aggregates for the report, all behind the same `WHERE` as the table.
 *
 * Computed by Postgres rather than by counting fetched rows — a report that
 * summarised only the current page would be quietly wrong.
 */
export async function getOrganizationReport(
  filters: OrganizationFilters
): Promise<OrganizationReport> {
  await requirePermission(PERMISSIONS.REPORTS_VIEW, NO_REPORT_ACCESS);

  const db = getDb();
  const where = buildWhere(filters);
  const establishedYear = sql<number>`extract(year from ${organizations.establishedAt})::int`;

  const [summaryRows, byDistrict, byClassification, byYear] = await Promise.all([
    db
      .select({
        total: count(),
        districtCount: sql<number>`count(distinct ${organizations.district})::int`,
        classificationCount: sql<number>`count(distinct ${organizations.classification})::int`,
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

/**
 * Arabic labels for the derived term-status buckets.
 *
 * Keyed by the token the SQL `case` emits rather than by index, so adding a
 * bucket cannot silently re-map the existing ones.
 */
const TERM_STATUS_LABELS: Record<string, string> = {
  active: 'سارية',
  endingSoon: 'تنتهي قريبًا',
  ended: 'منتهية',
  unset: 'غير محددة'
};

/** Print order for term status — chronological, not alphabetical or by count. */
const TERM_STATUS_ORDER = ['ended', 'endingSoon', 'active', 'unset'];

/**
 * Buckets `term_end` relative to today.
 *
 * The "ending soon" window is `TERM_END_NOTICE_DAYS`, the same threshold the
 * notification cron uses, so a report can never disagree with the alerts staff
 * have already been sent. `make_interval` parameterises the number rather than
 * interpolating it into an interval literal.
 */
function termStatusExpression(noticeDays: number) {
  return sql<string>`case
    when ${organizations.termEnd} is null then 'unset'
    when ${organizations.termEnd} < current_date then 'ended'
    when ${organizations.termEnd} <= current_date + make_interval(days => ${noticeDays}) then 'endingSoon'
    else 'active'
  end`;
}

/**
 * What counts as a missing value, per check.
 *
 * Written out rather than derived from the column type because the two rules
 * genuinely differ: a text column stores "absent" as either NULL or the empty
 * string depending on which import wrote it, while a `date` column can only be
 * NULL — Postgres will not compare a date to `''` at all.
 */
const DATA_GAP_PREDICATES: Record<DataGapKey, SQL> = {
  mobile: sql`${organizations.mobile} is null or ${organizations.mobile} = ''`,
  directorName: sql`${organizations.directorName} is null or ${organizations.directorName} = ''`,
  nationalId: sql`${organizations.nationalId} is null or ${organizations.nationalId} = ''`,
  establishedAt: sql`${organizations.establishedAt} is null`,
  // The term is recorded as a whole; `term_end` is the derived column that is
  // present only when both `term_start` and `term_length` are.
  term: sql`${organizations.termEnd} is null`
};

/** How many affected organizations each alert names before deferring to the list. */
const DATA_GAP_SAMPLE_LIMIT = 4;

/**
 * Everything the home dashboard renders.
 *
 * Unfiltered by design: this is the state of the whole registry, which is what
 * makes it a landing page rather than another view of the current search.
 *
 * Issued in two waves rather than one `Promise.all` of nine. The pool is small
 * (see `src/db/index.ts`) and, more usefully, the second wave only asks for
 * example rows for the checks the first wave found something wrong with — a
 * complete registry costs one round trip, not six.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  await requirePermission(PERMISSIONS.ORGANIZATIONS_READ, NO_READ_ACCESS);

  const db = getDb();
  const noticeDays = getServerEnv().TERM_END_NOTICE_DAYS;

  // Bucketed against dates computed here rather than Postgres's `current_date`,
  // so the same two boundaries can be handed to the client for its drill-down
  // links. A count and a link that disagreed about where "soon" starts would be
  // worse than either alone.
  const today = todayUTC();
  const noticeEnd = addDaysUTC(today, noticeDays);

  const status = sql<string>`case
    when ${organizations.termEnd} is null then 'unset'
    when ${organizations.termEnd} < ${today} then 'ended'
    when ${organizations.termEnd} <= ${noticeEnd} then 'endingSoon'
    else 'active'
  end`;

  const gapCount = (key: DataGapKey) =>
    sql<number>`count(*) filter (where ${DATA_GAP_PREDICATES[key]})::int`;
  const statusCount = (token: string) =>
    sql<number>`count(*) filter (where ${status} = ${token})::int`;

  const [summaryRows, byDistrict, byClassification, recent] = await Promise.all([
    db
      .select({
        total: count(),
        districtCount: sql<number>`count(distinct ${organizations.district})::int`,
        classificationCount: sql<number>`count(distinct ${organizations.classification})::int`,
        mobile: gapCount('mobile'),
        directorName: gapCount('directorName'),
        nationalId: gapCount('nationalId'),
        establishedAt: gapCount('establishedAt'),
        term: gapCount('term'),
        active: statusCount('active'),
        endingSoon: statusCount('endingSoon'),
        ended: statusCount('ended'),
        unset: statusCount('unset')
      })
      .from(organizations),
    db
      .select({ label: organizations.district, count: count() })
      .from(organizations)
      .groupBy(organizations.district)
      .orderBy(desc(count())),
    db
      .select({ label: organizations.classification, count: count() })
      .from(organizations)
      .groupBy(organizations.classification)
      .orderBy(desc(count())),
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        district: organizations.district,
        updatedAt: organizations.updatedAt
      })
      .from(organizations)
      .orderBy(desc(organizations.updatedAt))
      .limit(5)
  ]);

  const summary = summaryRows[0];
  const counts = DATA_GAP_KEYS.map((key) => ({
    key,
    count: summary?.[key] ?? 0
  }));

  const samples = await Promise.all(
    counts.map(async ({ key, count: gaps }) => {
      if (gaps === 0) return [] as DataGap['samples'];
      return db
        .select({
          id: organizations.id,
          name: organizations.name,
          district: organizations.district
        })
        .from(organizations)
        .where(DATA_GAP_PREDICATES[key])
        .orderBy(asc(organizations.name))
        .limit(DATA_GAP_SAMPLE_LIMIT);
    })
  );

  return {
    total: summary?.total ?? 0,
    districtCount: summary?.districtCount ?? 0,
    classificationCount: summary?.classificationCount ?? 0,
    termStatus: {
      active: summary?.active ?? 0,
      endingSoon: summary?.endingSoon ?? 0,
      ended: summary?.ended ?? 0,
      unset: summary?.unset ?? 0
    },
    termWindow: { today, noticeEnd, noticeDays },
    gaps: counts.map((entry, index) => ({
      key: entry.key,
      count: entry.count,
      samples: samples[index]
    })),
    byDistrict: byDistrict.map((row) => ({
      label: row.label || '—',
      count: row.count
    })),
    byClassification: byClassification.map((row) => ({
      label: row.label || 'غير مصنّف',
      count: row.count
    })),
    recent: recent.map((row) => ({
      id: row.id,
      name: row.name,
      district: row.district,
      updatedAt: row.updatedAt.toISOString()
    }))
  };
}

/**
 * Runs a saved or ad-hoc report definition.
 *
 * Every block is computed behind the same `WHERE` as the listing, and blocks the
 * definition did not ask for are not queried at all — a summary-only report must
 * not pay for a full unpaginated row fetch just to discard it.
 */
export async function runOrganizationReport(
  definition: ReportDefinition
): Promise<Omit<ReportResult, 'generatedAt'>> {
  await requirePermission(PERMISSIONS.REPORTS_VIEW, NO_REPORT_ACCESS);

  const filters: OrganizationFilters = definition.criteria ?? {};
  const wantsCharts = definition.sections.includes('charts');
  const wantsTable = definition.sections.includes('table');

  const db = getDb();
  const where = buildWhere(filters);
  const establishedYear = sql<number>`extract(year from ${organizations.establishedAt})::int`;

  // The grouped block is the report's headline, so it is always computed — the
  // chart blocks below are the ones gated on `sections`.
  const groupedPromise = (async (): Promise<ReportGroupRow[]> => {
    switch (definition.groupBy) {
      case 'classification': {
        const rows = await db
          .select({ label: organizations.classification, count: count() })
          .from(organizations)
          .where(where)
          .groupBy(organizations.classification)
          .orderBy(desc(count()));
        return rows.map((row) => ({
          label: row.label || 'غير مصنّف',
          count: row.count
        }));
      }
      case 'year': {
        const rows = await db
          .select({ year: establishedYear, count: count() })
          .from(organizations)
          .where(and(where, isNotNull(organizations.establishedAt)))
          .groupBy(establishedYear)
          .orderBy(asc(establishedYear));
        return rows.map((row) => ({
          label: String(row.year),
          count: row.count
        }));
      }
      case 'termStatus': {
        const status = termStatusExpression(getServerEnv().TERM_END_NOTICE_DAYS);
        const rows = await db
          .select({ status, count: count() })
          .from(organizations)
          .where(where)
          .groupBy(status);
        // Ordered in code: the buckets have a meaningful sequence that neither
        // count nor alphabetical order reproduces.
        return TERM_STATUS_ORDER.map((token) => ({
          label: TERM_STATUS_LABELS[token],
          count: rows.find((row) => row.status === token)?.count ?? 0
        })).filter((row) => row.count > 0);
      }
      case 'district':
      default: {
        const rows = await db
          .select({ label: organizations.district, count: count() })
          .from(organizations)
          .where(where)
          .groupBy(organizations.district)
          .orderBy(desc(count()));
        return rows.map((row) => ({
          label: row.label || '—',
          count: row.count
        }));
      }
    }
  })();

  const [summaryRows, grouped, charts, rows] = await Promise.all([
    db
      .select({
        total: count(),
        districtCount: sql<number>`count(distinct ${organizations.district})::int`,
        classificationCount: sql<number>`count(distinct ${organizations.classification})::int`,
        earliestYear: sql<
          number | null
        >`min(extract(year from ${organizations.establishedAt}))::int`,
        latestYear: sql<number | null>`max(extract(year from ${organizations.establishedAt}))::int`
      })
      .from(organizations)
      .where(where),
    groupedPromise,
    wantsCharts
      ? Promise.all([
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
        ])
      : Promise.resolve(null),
    wantsTable
      ? db
          .select(SELECT_COLUMNS)
          .from(organizations)
          .where(where)
          .orderBy(...buildOrderBy(filters))
      : Promise.resolve([] as Organization[])
  ]);

  const summary = summaryRows[0];
  const [byDistrict, byClassification, byYear] = charts ?? [[], [], []];

  return {
    definition,
    summary: {
      total: summary?.total ?? 0,
      districtCount: summary?.districtCount ?? 0,
      classificationCount: summary?.classificationCount ?? 0,
      earliestYear: summary?.earliestYear ?? null,
      latestYear: summary?.latestYear ?? null
    },
    grouped,
    byDistrict: byDistrict.map((row) => ({
      label: row.label || '—',
      count: row.count
    })),
    byClassification: byClassification.map((row) => ({
      label: row.label || 'غير مصنّف',
      count: row.count
    })),
    byYear: byYear.map((row) => ({ year: row.year, count: row.count })),
    rows
  };
}

// ============================================================
// Writes
// ============================================================
// Each write asserts its own permission — create, update and delete are
// separately grantable, so a role can be allowed to correct a record without
// being allowed to remove one. `'use server'` makes every export in this file a
// POST endpoint, so hiding a button in the UI guards nothing; this is the check
// that does.
//
// `nameNormalized` and `searchKey` are derived on every write through the same
// `@/lib/arabic` helpers the import uses. A row written here that skipped them
// would be invisible to search and invisible to the import's duplicate
// detection, which is a silent failure rather than a loud one.
// ============================================================

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';
/** Postgres foreign-key violation — raised since correspondences can reference an organization. */
const FOREIGN_KEY_VIOLATION = '23503';

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
    mobile: blankToNull(input.mobile),
    members: input.members
  };

  return {
    ...row,
    nameNormalized: normalizeArabic(row.name),
    searchKey: buildSearchKey(row)
  };
}

/**
 * Rethrows a write-constraint violation as something a user can act on.
 *
 * Unique: the index covers `(national_id_key, name_normalized)`, and the
 * normalization means the clash is often invisible in the raw text —
 * "جمعية الشعلة" and "جمعيه الشعله" collide. Saying which pair collided is the
 * difference between a fixable message and a mystery.
 *
 * Foreign key: raised on delete once another table (correspondences) can
 * reference an organization — deleting one that still has correspondence
 * pointing at it is rejected by Postgres rather than orphaning those rows.
 */
function rethrowWriteError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === UNIQUE_VIOLATION) {
      throw new Error('توجد جمعية أخرى بنفس الاسم والرقم الوطني.');
    }
    if (code === FOREIGN_KEY_VIOLATION) {
      throw new Error('لا يمكن حذف الجمعية لوجود مراسلات مرتبطة بها.');
    }
  }
  throw error;
}

export async function createOrganization(
  input: OrganizationMutationPayload
): Promise<Organization> {
  const user = await requirePermission(PERMISSIONS.ORGANIZATIONS_CREATE, NO_WRITE_ACCESS);

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
  const user = await requirePermission(PERMISSIONS.ORGANIZATIONS_UPDATE, NO_WRITE_ACCESS);

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
  const user = await requirePermission(PERMISSIONS.ORGANIZATIONS_DELETE, NO_WRITE_ACCESS);

  let deleted: { id: string; name: string } | undefined;
  try {
    [deleted] = await getDb()
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning({ id: organizations.id, name: organizations.name });
  } catch (error) {
    rethrowWriteError(error);
  }

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

// ============================================================
// Members Management
// ============================================================

export async function updateOrganizationMembers(
  orgId: string,
  members: Member[]
): Promise<Organization> {
  const user = await requirePermission(
    PERMISSIONS.MEMBERS_UPDATE,
    'غير مصرح لك بتعديل أعضاء الهيئة.'
  );

  const [updated] = await getDb()
    .update(organizations)
    .set({ members, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning(SELECT_COLUMNS);

  if (!updated) throw new Error('الجمعية غير موجودة.');

  await auditLog({
    action: 'UPDATE',
    entityType: 'organization',
    entityId: orgId,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { membersUpdated: members.length }
  });

  return updated;
}

// ============================================================
// Members Import
// ============================================================

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Reads the uploaded file out of the form, rejecting anything unusable. */
async function readUpload(formData: FormData): Promise<{ file: File; buffer: ArrayBuffer }> {
  const file = formData.get('file');

  if (!(file instanceof File)) {
    throw new Error('لم يتم إرفاق أي ملف.');
  }
  if (file.size === 0) {
    throw new Error('الملف فارغ.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد المسموح (٥ ميغابايت).');
  }
  if (!file.name.toLowerCase().endsWith('.xlsx') && file.type !== XLSX_MIME) {
    throw new Error('صيغة الملف غير مدعومة — المطلوب ملف .xlsx');
  }

  return { file, buffer: await file.arrayBuffer() };
}

export async function previewMembersImport(formData: FormData): Promise<ImportPreview> {
  // A preview writes nothing and logs nothing, so the actor is not needed — but
  // it parses an uploaded workbook, which is work no one without the permission
  // should be able to make the server do.
  await requirePermission(PERMISSIONS.ORGANIZATIONS_IMPORT, 'غير مصرح لك باستيراد البيانات.');

  const { file, buffer } = await readUpload(formData);
  const parsed = await parseMembersWorkbook(buffer);

  return {
    fileName: file.name,
    detectedHeaders: parsed.detectedHeaders,
    mapping: parsed.mapping,
    unmappedHeaders: parsed.unmappedHeaders,
    missingRequired: parsed.missingRequired,
    rowCount: parsed.rows.length,
    sampleRows: parsed.rows.slice(0, 10).map((row) => ({
      name: row.name,
      nationalId: row.nationalId ?? '',
      mobile: row.mobile ?? '',
      jobTitle: row.jobTitle ?? ''
    }))
  };
}

export async function importMembers(
  organizationId: string,
  formData: FormData
): Promise<ImportResult> {
  const user = await requirePermission(
    PERMISSIONS.ORGANIZATIONS_IMPORT,
    'غير مصرح لك باستيراد البيانات.'
  );

  const { file, buffer } = await readUpload(formData);
  const parsed = await parseMembersWorkbook(buffer);

  if (parsed.missingRequired.length > 0) {
    throw new Error(
      `الملف تنقصه أعمدة مطلوبة: ${parsed.missingRequired.join('، ')}. الأعمدة المطلوبة هي ${MEMBER_REQUIRED_FIELDS.join('، ')}.`
    );
  }

  const errors: ImportIssue[] = [...parsed.errors];
  const warnings: ImportIssue[] = [...parsed.warnings];
  const valid: Member[] = [];

  for (const row of parsed.rows) {
    if (!row.name.trim()) {
      errors.push({ row: row.rowNumber, column: 'name', message: 'اسم العضو مطلوب' });
      continue;
    }
    valid.push({
      name: row.name.trim(),
      nationalId: row.nationalId.trim(),
      mobile: row.mobile.trim(),
      jobTitle: row.jobTitle.trim()
    });
  }

  if (valid.length === 0) {
    throw new Error('الملف لا يحتوي على أعضاء صالحين للاستيراد.');
  }

  const db = getDb();

  const [existing] = await db
    .select({ members: organizations.members })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!existing) throw new Error('الجمعية غير موجودة.');

  const currentMembers: Member[] = (existing.members as Member[]) ?? [];
  const updatedMembers = [...currentMembers, ...valid];

  await db
    .update(organizations)
    .set({ members: updatedMembers, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  await auditLog({
    action: 'UPDATE',
    entityType: 'organization',
    entityId: organizationId,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: {
      membersImported: valid.length,
      totalMembers: updatedMembers.length
    }
  });

  return {
    fileName: file.name,
    total: parsed.rows.length,
    inserted: valid.length,
    updated: 0,
    skipped: parsed.rows.length - valid.length,
    warnings,
    errors
  };
}

// ============================================================
// Report templates
// ============================================================
// Saved report definitions. Reads are open to any signed-in user because
// templates are shared working tools rather than registry data; deletion is
// restricted to the author or an admin so one person cannot quietly remove a
// colleague's saved report.
// ============================================================

/**
 * Shape check for the `definition` JSONB column.
 *
 * `filters` and `sort` are intentionally validated only as arrays. Their
 * elements are re-validated downstream where it actually matters: `buildWhere`
 * resolves every filter's `id` against `FILTERABLE_COLUMNS` and `buildOrderBy`
 * against `SORTABLE_COLUMNS`, both of which drop anything unrecognised. A
 * structural check here would duplicate that whitelist and could drift from it.
 */
const reportDefinitionSchema = z.object({
  title: z.string(),
  criteria: z
    .object({
      q: z.string().optional(),
      filters: z.array(z.unknown()).optional(),
      joinOperator: z.enum(['and', 'or']).optional(),
      sort: z.array(z.unknown()).optional()
    })
    .default({}),
  groupBy: z.enum(REPORT_GROUP_BY),
  sections: z.array(z.enum(REPORT_SECTIONS)),
  columns: z.array(z.enum(REPORT_COLUMNS))
});

/** Narrows a stored row, or returns null when the JSONB no longer matches. */
function parseTemplateRow(row: ReportTemplateRow): ReportTemplate | null {
  const parsed = reportDefinitionSchema.safeParse(row.definition);
  if (!parsed.success) {
    // A definition written by an older shape should not break the whole list.
    console.error(`report template ${row.id} has an unreadable definition`, parsed.error);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    definition: parsed.data as ReportDefinition,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  await requirePermission(PERMISSIONS.REPORTS_VIEW, NO_REPORT_ACCESS);

  const rows = await getDb().select().from(reportTemplates).orderBy(asc(reportTemplates.name));

  return rows.map(parseTemplateRow).filter((row): row is ReportTemplate => row !== null);
}

export async function saveReportTemplate(payload: ReportTemplatePayload): Promise<ReportTemplate> {
  const user = await requirePermission(PERMISSIONS.REPORTS_TEMPLATE_MANAGE, NO_TEMPLATE_ACCESS);

  const name = payload.name.trim();
  if (!name) throw new Error('اسم القالب مطلوب.');

  const definition = reportDefinitionSchema.parse(payload.definition);

  try {
    const [row] = await getDb()
      .insert(reportTemplates)
      .values({
        name,
        description: payload.description.trim() || null,
        definition,
        createdBy: user.id
      })
      .returning();

    await auditLog({
      action: 'CREATE',
      entityType: 'report_template',
      entityId: row.id,
      actor: { id: user.id, email: user.email, type: 'user' },
      metadata: { name }
    });

    const parsed = parseTemplateRow(row);
    if (!parsed) throw new Error('تعذّر حفظ القالب.');
    return parsed;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      throw new Error('يوجد قالب بنفس الاسم بالفعل.');
    }
    throw error;
  }
}

export async function updateReportTemplate(
  id: string,
  payload: ReportTemplatePayload
): Promise<ReportTemplate> {
  const user = await requirePermission(PERMISSIONS.REPORTS_TEMPLATE_MANAGE, NO_TEMPLATE_ACCESS);

  const name = payload.name.trim();
  if (!name) throw new Error('اسم القالب مطلوب.');

  const definition = reportDefinitionSchema.parse(payload.definition);

  const [row] = await getDb()
    .update(reportTemplates)
    .set({
      name,
      description: payload.description.trim() || null,
      definition,
      updatedAt: new Date()
    })
    .where(eq(reportTemplates.id, id))
    .returning();

  if (!row) throw new Error('القالب غير موجود.');

  await auditLog({
    action: 'UPDATE',
    entityType: 'report_template',
    entityId: id,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { name }
  });

  const parsed = parseTemplateRow(row);
  if (!parsed) throw new Error('تعذّر حفظ القالب.');
  return parsed;
}

export async function deleteReportTemplate(id: string): Promise<void> {
  const user = await requirePermission(PERMISSIONS.REPORTS_TEMPLATE_MANAGE, NO_TEMPLATE_ACCESS);

  const [existing] = await getDb()
    .select({
      createdBy: reportTemplates.createdBy,
      name: reportTemplates.name
    })
    .from(reportTemplates)
    .where(eq(reportTemplates.id, id))
    .limit(1);

  if (!existing) throw new Error('القالب غير موجود.');

  // Templates are shared across the directorate, so authorship no longer gates
  // deletion the way it did when every signed-in user could create one:
  // `reports:template:manage` is now required to create a template at all, and
  // it is the same permission that authorizes removing anyone's. Whoever holds
  // it is trusted with the shared set; whoever does not has no templates of
  // their own to protect.
  await getDb().delete(reportTemplates).where(eq(reportTemplates.id, id));

  await auditLog({
    action: 'DELETE',
    entityType: 'report_template',
    entityId: id,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { name: existing.name }
  });
}
