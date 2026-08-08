import type { ExtendedColumnFilter } from '@/types/data-table';
import { serializeOrganizationsParams } from '../api/search-params';
import type { DashboardOverview, DataGapKey, Organization } from '../api/types';

/**
 * Links from the dashboard into the registry listing, pre-filtered.
 *
 * Built through `serializeOrganizationsParams` — the same serializer the table
 * and the report use — rather than by assembling a query string by hand, so a
 * change to the URL shape cannot leave these links pointing at a filter the
 * listing no longer parses.
 *
 * Every alert on the dashboard is a count, and every count must be openable as
 * the rows behind it. That round trip is the whole point of the alert: seeing
 * that 12 organizations have no phone number is only useful if it is one click
 * from the twelve records that need one.
 */

/**
 * Dates travel as epoch milliseconds, which is what the filter panel's own date
 * picker emits. `buildCondition` accepts ISO strings too, but a link that spells
 * a date differently from the UI would come back as an empty picker when the
 * user opened the filter to adjust it.
 */
function toFilterDate(isoDate: string): string {
  return String(Date.parse(`${isoDate}T00:00:00Z`));
}

function listingHref(filters: ExtendedColumnFilter<Organization>[]): string {
  return `/dashboard/organizations${serializeOrganizationsParams({ filters })}`;
}

/**
 * The filter behind each missing-data alert.
 *
 * `filterId` is a fixed string rather than a generated one: these are stable
 * links, and a fresh id per render would make every dashboard paint a different
 * URL for the same query.
 */
const DATA_GAP_FILTERS: Record<DataGapKey, ExtendedColumnFilter<Organization>> = {
  mobile: { id: 'mobile', value: '', variant: 'text', operator: 'isEmpty', filterId: 'gap-mobile' },
  directorName: {
    id: 'directorName',
    value: '',
    variant: 'text',
    operator: 'isEmpty',
    filterId: 'gap-director'
  },
  nationalId: {
    id: 'nationalId',
    value: '',
    variant: 'text',
    operator: 'isEmpty',
    filterId: 'gap-national-id'
  },
  establishedAt: {
    id: 'establishedAt',
    value: '',
    variant: 'dateRange',
    operator: 'isEmpty',
    filterId: 'gap-established'
  },
  // "No term recorded" is the absence of the derived end date — see the note on
  // `DATA_GAP_PREDICATES` in the service.
  term: {
    id: 'termEnd',
    value: '',
    variant: 'dateRange',
    operator: 'isEmpty',
    filterId: 'gap-term'
  }
};

export function dataGapHref(key: DataGapKey): string {
  return listingHref([DATA_GAP_FILTERS[key]]);
}

export type TermStatusKey = keyof DashboardOverview['termStatus'];

/**
 * The rows behind one term-status bucket.
 *
 * Takes the window the server bucketed against rather than reading the clock —
 * the count and the link it sits on have to describe the same day.
 */
export function termStatusHref(
  status: TermStatusKey,
  window: DashboardOverview['termWindow']
): string {
  const today = toFilterDate(window.today);
  const noticeEnd = toFilterDate(window.noticeEnd);

  const filters: Record<TermStatusKey, ExtendedColumnFilter<Organization>> = {
    ended: {
      id: 'termEnd',
      value: today,
      variant: 'dateRange',
      operator: 'lt',
      filterId: 'term-ended'
    },
    endingSoon: {
      id: 'termEnd',
      value: [today, noticeEnd],
      variant: 'dateRange',
      operator: 'isBetween',
      filterId: 'term-ending-soon'
    },
    active: {
      id: 'termEnd',
      value: noticeEnd,
      variant: 'dateRange',
      operator: 'gt',
      filterId: 'term-active'
    },
    unset: {
      id: 'termEnd',
      value: '',
      variant: 'dateRange',
      operator: 'isEmpty',
      filterId: 'term-unset'
    }
  };

  return listingHref([filters[status]]);
}

/** One organization's page — where a missing value is actually filled in. */
export function organizationHref(id: string): string {
  return `/dashboard/organizations/${id}`;
}
