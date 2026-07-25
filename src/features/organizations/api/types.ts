import type { OrganizationRow } from '@/db/schema/organizations';
import type { ExtendedColumnFilter, ExtendedColumnSort, JoinOperator } from '@/types/data-table';

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
    withMobile: number;
    withDirector: number;
    earliestYear: number | null;
    latestYear: number | null;
  };
  byDistrict: { label: string; count: number }[];
  byClassification: { label: string; count: number }[];
  byYear: { year: number; count: number }[];
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
