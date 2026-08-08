import type { FilterListLabels } from '@/components/ui/table/data-table-filter-list';
import {
  FILTER_OPERATOR_LABELS,
  JOIN_OPERATOR_LABELS,
  ORGANIZATION_LABELS,
  RELATIVE_DATE_LABELS
} from './labels';

/**
 * Wiring for the shared filter builder, assembled from the feature's vocabulary.
 *
 * Hoisted out of the table because the report page now builds the same
 * conditions against the same columns. Two copies of this object would drift the
 * moment a string changed on one screen and not the other.
 */
export const ORGANIZATION_FILTER_LABELS: FilterListLabels = {
  trigger: ORGANIZATION_LABELS.filters.trigger,
  empty: ORGANIZATION_LABELS.filters.empty,
  add: ORGANIZATION_LABELS.filters.add,
  apply: ORGANIZATION_LABELS.filters.apply,
  reset: ORGANIZATION_LABELS.filters.reset,
  remove: ORGANIZATION_LABELS.filters.remove,
  where: ORGANIZATION_LABELS.filters.where,
  selectField: ORGANIZATION_LABELS.filters.selectField,
  selectOperator: ORGANIZATION_LABELS.filters.selectOperator,
  value: ORGANIZATION_LABELS.filters.value,
  from: ORGANIZATION_LABELS.filters.from,
  to: ORGANIZATION_LABELS.filters.to,
  operator: FILTER_OPERATOR_LABELS,
  join: JOIN_OPERATOR_LABELS,
  relativeDate: RELATIVE_DATE_LABELS
};
