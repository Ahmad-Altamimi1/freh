import { formatDateAr } from '@/lib/format';
import { RELATIVE_DATE_TOKENS, type RelativeDateToken } from '@/lib/filter-columns';
import { getValidFilters } from '@/lib/data-table';
import type { ExtendedColumnFilter } from '@/types/data-table';
import {
  FILTER_OPERATOR_LABELS,
  ORGANIZATION_FIELD_LABELS,
  RELATIVE_DATE_LABELS,
  type OrganizationField
} from '../constants/labels';
import type { Organization, OrganizationFilters } from './types';

/**
 * Renders the active filter state as readable Arabic.
 *
 * Used on the report page and on the export's criteria sheet. Both need to state
 * what the numbers describe: a report showing 16 societies is meaningless
 * without "اللواء: قصبة اربد أو الرمثا" beside it, and an exported file outlives
 * the URL that produced it entirely.
 */

export type FilterDescription = { label: string; value: string };

function isRelativeToken(value: string): value is RelativeDateToken {
  return (RELATIVE_DATE_TOKENS as readonly string[]).includes(value);
}

/** Formats one stored filter value for display. */
function describeValue(filter: ExtendedColumnFilter<Organization>): string {
  const { variant, operator, value } = filter;
  const values = Array.isArray(value) ? value : [value];

  if (operator === 'isEmpty' || operator === 'isNotEmpty') return '';

  if (operator === 'isRelativeToToday') {
    const token = values[0];
    return token && isRelativeToken(token) ? RELATIVE_DATE_LABELS[token] : '';
  }

  const isDate = variant === 'date' || variant === 'dateRange';
  const render = (raw: string) => {
    if (!raw) return '…';
    if (!isDate) return raw;
    const parsed = new Date(/^\d+$/.test(raw) ? Number(raw) : raw);
    return Number.isNaN(parsed.getTime()) ? raw : formatDateAr(parsed);
  };

  if (operator === 'isBetween') {
    return `${render(values[0] ?? '')} — ${render(values[1] ?? '')}`;
  }

  return values.filter(Boolean).map(render).join('، ');
}

/**
 * One line per active condition, prefixed by the quick-search term when present.
 *
 * Invalid conditions are dropped by `getValidFilters` first, so the description
 * lists exactly the conditions that reached the database — never a condition
 * that was displayed but had no effect.
 */
export function describeFilters(filters: OrganizationFilters): FilterDescription[] {
  const lines: FilterDescription[] = [];

  if (filters.q) {
    lines.push({ label: 'بحث', value: filters.q });
  }

  const valid = getValidFilters(filters.filters ?? []);
  const join = filters.joinOperator === 'or' ? 'أو' : 'و';

  valid.forEach((filter, index) => {
    const field = filter.id as OrganizationField;
    const fieldLabel = ORGANIZATION_FIELD_LABELS[field] ?? String(filter.id);
    const operatorLabel = FILTER_OPERATOR_LABELS[filter.operator] ?? filter.operator;
    const valueLabel = describeValue(filter);

    lines.push({
      // The join word leads every condition after the first, so reading the list
      // top to bottom reproduces the logic rather than implying AND throughout.
      label: index === 0 ? fieldLabel : `${join} ${fieldLabel}`,
      value: valueLabel ? `${operatorLabel} ${valueLabel}` : operatorLabel
    });
  });

  return lines;
}
