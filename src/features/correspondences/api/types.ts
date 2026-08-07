import { CORRESPONDENCE_TYPES } from '@/db/schema/correspondences';
import type {
  CorrespondenceFile,
  CorrespondenceRow,
  CorrespondenceType
} from '@/db/schema/correspondences';
import type { ExtendedColumnFilter, ExtendedColumnSort, JoinOperator } from '@/types/data-table';

export { CORRESPONDENCE_TYPES };
export type { CorrespondenceFile, CorrespondenceType };

/**
 * A correspondence as the UI sees it.
 *
 * `nameNormalized` and `searchKey` are write-time derivations that exist to
 * make Arabic matching work — exposing them would invite treating a folded,
 * lossy value as data. `organizationName` is not a column at all; it comes
 * from the join every read performs, so a caller never has to look the
 * organization up separately just to render its name.
 */
export type Correspondence = Omit<CorrespondenceRow, 'nameNormalized' | 'searchKey'> & {
  organizationName: string;
};

export type CorrespondenceFileWithUrl = CorrespondenceFile & { url: string | null };

/** What the detail page reads — files carry short-lived signed URLs, generated server-side. */
export type CorrespondenceWithFiles = Omit<Correspondence, 'files'> & {
  files: CorrespondenceFileWithUrl[];
};

/** The complete query state for the correspondences table. */
export type CorrespondenceFilters = {
  page?: number;
  perPage?: number;
  sort?: ExtendedColumnSort<Correspondence>[];
  /** Quick search — matched against the normalized `search_key` column. */
  q?: string;
  filters?: ExtendedColumnFilter<Correspondence>[];
  joinOperator?: JoinOperator;
};

export type CorrespondencesResponse = {
  data: Correspondence[];
  /** Rows matching the filter, not rows on this page. */
  total: number;
  pageCount: number;
};

/** Distinct organizations that have at least one correspondence, with counts. Unfiltered — see service.ts. */
export type CorrespondenceFacets = {
  organizations: { value: string; label: string; count: number }[];
};
