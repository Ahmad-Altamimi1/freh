import type { OrganizationRow } from '@/db/schema/organizations';
import type { ExtendedColumnFilter, ExtendedColumnSort, JoinOperator } from '@/types/data-table';

export type Member = {
  name: string;
  nationalId: string;
  mobile: string;
  jobTitle: string;
};

/**
 * An organization as the UI sees it.
 *
 * The three matching columns are deliberately absent: `nameNormalized` and
 * `searchKey` are write-time derivations that exist to make Arabic matching
 * work, and `nationalIdKey` is maintained by Postgres purely so the upsert has a
 * column to conflict on. Exposing any of them would invite someone to treat a
 * folded, lossy value as data.
 */
export type Organization = Omit<OrganizationRow, 'nameNormalized' | 'searchKey' | 'nationalIdKey'>;

/** The complete query state for a listing or a report. */
export type OrganizationFilters = {
  page?: number;
  perPage?: number;
  sort?: ExtendedColumnSort<Organization>[];
  /** Quick search across name, director, district, classification, ID, mobile. */
  q?: string;
  filters?: ExtendedColumnFilter<Organization>[];
  joinOperator?: JoinOperator;
};

export type OrganizationsResponse = {
  data: Organization[];
  /** Rows matching the filter, not rows on this page. */
  total: number;
  pageCount: number;
};

/** Distinct values for the faceted filters, counted under the current filter. */
export type OrganizationFacets = {
  districts: { value: string; count: number }[];
  classifications: { value: string; count: number }[];
};

export type OrganizationReport = {
  summary: {
    total: number;
    districtCount: number;
    classificationCount: number;
    earliestYear: number | null;
    latestYear: number | null;
  };
  byDistrict: { label: string; count: number }[];
  byClassification: { label: string; count: number }[];
  byYear: { year: number; count: number }[];
};

/* -------------------------------------------------------------------------- */
/*                                  Dashboard                                 */
/* -------------------------------------------------------------------------- */

/**
 * The missing-data checks the dashboard alerts on.
 *
 * Each key is both the alert's identity and the column it is about — `term`
 * being the one exception, since "no term recorded" is a missing `termEnd`,
 * which is itself derived from `termStart` + `termLength`.
 */
export const DATA_GAP_KEYS = [
  'mobile',
  'directorName',
  'nationalId',
  'establishedAt',
  'term'
] as const;
export type DataGapKey = (typeof DATA_GAP_KEYS)[number];

/** One missing-data alert: how many rows, and a few of them to jump straight into. */
export type DataGap = {
  key: DataGapKey;
  count: number;
  /** The first few affected organizations, so the alert can link into the record itself. */
  samples: { id: string; name: string; district: string }[];
};

export type DashboardOverview = {
  total: number;
  districtCount: number;
  classificationCount: number;
  /** Term buckets relative to today, using the same notice window as the alerts. */
  termStatus: {
    active: number;
    endingSoon: number;
    ended: number;
    unset: number;
  };
  /**
   * The boundaries the buckets were computed against, resolved on the server.
   *
   * The client builds its drill-down links from these rather than from its own
   * clock: a browser a day ahead of the server would otherwise link to a filter
   * that disagrees with the count it was rendered next to.
   */
  termWindow: { today: string; noticeEnd: string; noticeDays: number };
  gaps: DataGap[];
  byDistrict: { label: string; count: number }[];
  byClassification: { label: string; count: number }[];
  recent: { id: string; name: string; district: string; updatedAt: string }[];
};

/* -------------------------------------------------------------------------- */
/*                              Report definitions                            */
/* -------------------------------------------------------------------------- */

/**
 * The dimension a report groups its rows by.
 *
 * `termStatus` is derived rather than stored — see `TERM_STATUS_BUCKETS` in the
 * service. The other three map straight onto columns.
 */
export const REPORT_GROUP_BY = ['district', 'classification', 'year', 'termStatus'] as const;
export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number];

/** Blocks a report may include, in the order they are printed. */
export const REPORT_SECTIONS = ['criteria', 'summary', 'charts', 'table'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** Fields offered to the detail table's column picker. */
export const REPORT_COLUMNS = [
  'serialNo',
  'name',
  'nationalId',
  'district',
  'classification',
  'establishedAt',
  'termStart',
  'termEnd',
  'termLength',
  'directorName',
  'mobile'
] as const;
export type ReportColumn = (typeof REPORT_COLUMNS)[number];

/**
 * A complete, re-runnable description of a report.
 *
 * Everything needed to reproduce the document lives here, which is what makes a
 * template meaningful: storing only the filter would leave the shape (grouping,
 * sections, columns) to whatever the UI happened to default to on the day it was
 * re-opened.
 */
export type ReportDefinition = {
  /** Printed as the document's title. */
  title: string;
  /** Which rows the report is about. Mirrors `OrganizationFilters` minus paging. */
  criteria: {
    q?: string;
    filters?: ExtendedColumnFilter<Organization>[];
    joinOperator?: JoinOperator;
    sort?: ExtendedColumnSort<Organization>[];
  };
  groupBy: ReportGroupBy;
  sections: ReportSection[];
  columns: ReportColumn[];
};

/** One bucket of the grouped aggregation. */
export type ReportGroupRow = { label: string; count: number };

/** What the report page and the print route both render. */
export type ReportResult = {
  definition: ReportDefinition;
  summary: OrganizationReport['summary'];
  /** Aggregation for `definition.groupBy`. */
  grouped: ReportGroupRow[];
  byDistrict: ReportGroupRow[];
  byClassification: ReportGroupRow[];
  byYear: { year: number; count: number }[];
  /** Detail rows, present only when the `table` section is selected. */
  rows: Organization[];
  generatedAt: string;
};

/** A saved, named report definition. */
export type ReportTemplate = {
  id: string;
  name: string;
  description: string | null;
  definition: ReportDefinition;
  createdAt: string;
  updatedAt: string;
};

export type ReportTemplatePayload = {
  name: string;
  description: string;
  definition: ReportDefinition;
};

/**
 * What create and update accept.
 *
 * Only the fields a person edits. `nameNormalized` and `searchKey` are derived
 * by the write layer and `nationalIdKey` by Postgres, so none of them appear
 * here — a caller able to set them could desynchronise matching from the data.
 * `termEnd` is absent for the same reason: it is always `termStart` +
 * `termLength`, recomputed by the write layer on every save.
 */
export type OrganizationMutationPayload = {
  name: string;
  district: string;
  classification: string;
  nationalId: string;
  /** `YYYY-MM-DD`, or `''` for unset. */
  establishedAt: string;
  /** `YYYY-MM-DD`, or `''` for unset. */
  termStart: string;
  /** Months, or `''` for unset. */
  termLength: number | '';
  directorName: string;
  mobile: string;
  /** Board members. */
  members: Member[];
};

/** One problem found in one row of an uploaded file. */
export type ImportIssue = {
  /** 1-based row number in the source worksheet, so it matches what Excel shows. */
  row: number;
  column?: string;
  message: string;
};

export type ImportResult = {
  fileName: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Rows that were written despite a questionable value. */
  warnings: ImportIssue[];
  /** Rows that were not written. */
  errors: ImportIssue[];
};

/** What the preview step reports back before anything is written. */
export type ImportPreview = {
  fileName: string;
  /** Header text found in the worksheet, in column order. */
  detectedHeaders: string[];
  /** Recognised header -> organization field. */
  mapping: Record<string, string>;
  /** Headers present in the file that map to nothing. Informational only. */
  unmappedHeaders: string[];
  /** Required fields with no matching column — these block the import. */
  missingRequired: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
};
