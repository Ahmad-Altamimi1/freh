import type { ExtendedColumnFilter } from '@/types/data-table';
import type { Organization } from '../api/types';

/**
 * Reading and writing a facet picker as an ordinary filter condition.
 *
 * A district selection is not a second kind of filter — it is
 * `district inArray [...]`, exactly what the advanced builder would produce.
 * Keeping one representation is what lets either control edit what the other
 * built, and lets the pills, the Excel export and the printed criteria block
 * describe it with no special case.
 *
 * Pure functions rather than a hook: the two pages that use them hold their
 * filter state differently, and neither needs to own this logic.
 */

/** Columns backed by a facet picker. Both are `multiSelect` in the column defs. */
export type FacetColumn = 'district' | 'classification';

export function readFacetValues(
  filters: ExtendedColumnFilter<Organization>[],
  columnId: FacetColumn
): string[] {
  const condition = filters.find(
    (filter) => filter.id === columnId && filter.operator === 'inArray'
  );
  if (!condition) return [];
  return Array.isArray(condition.value) ? condition.value : [condition.value];
}

export function writeFacetValues(
  filters: ExtendedColumnFilter<Organization>[],
  columnId: FacetColumn,
  values: string[]
): ExtendedColumnFilter<Organization>[] {
  const index = filters.findIndex(
    (filter) => filter.id === columnId && filter.operator === 'inArray'
  );

  if (values.length === 0) {
    return index >= 0 ? filters.filter((_, at) => at !== index) : filters;
  }

  const condition: ExtendedColumnFilter<Organization> = {
    id: columnId,
    value: values,
    variant: 'multiSelect',
    operator: 'inArray',
    // Reuse the row's identity when replacing, so editing a condition the
    // builder created does not make it jump to the end of the list.
    filterId: index >= 0 ? filters[index].filterId : `facet-${columnId}`
  };

  return index >= 0
    ? filters.map((filter, at) => (at === index ? condition : filter))
    : [...filters, condition];
}
