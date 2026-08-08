import type { ExtendedColumnFilter, FilterOperator, FilterVariant } from '@/types/data-table';
import type { Column } from '@tanstack/react-table';

import { dataTableConfig } from '@/config/data-table';

export function getCommonPinningStyles<TData>({
  column,
  background = 'var(--background)'
}: {
  column: Column<TData>;
  /**
   * What a pinned cell paints behind itself.
   *
   * A pinned cell is `position: sticky`, so it needs an opaque background or
   * the columns it floats over show through it. It cannot be left to the row:
   * `background` is not an inherited property, so the header row's `bg-muted`
   * never reaches the cell — which is why the default paints a header cell in
   * the body's colour and leaves a pale patch above the pinned column. Callers
   * in a tinted row pass that row's colour instead.
   */
  background?: string;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right');

  return {
    boxShadow: isLastLeftPinnedColumn
      ? '-5px 0 5px -5px var(--border) inset'
      : isFirstRightPinnedColumn
        ? '5px 0 5px -5px var(--border) inset'
        : undefined,
    // Logical inset properties rather than `left`/`right`.
    //
    // TanStack's pinning sides are logical, not physical: 'left' means the
    // leading edge — the side a row starts from — and `getStart`/`getAfter`
    // measure from there. On an RTL page the leading edge is the right one, so
    // writing `left` would pin the column to the wrong side of the table while
    // still measuring its offset from the other, stacking pinned columns on top
    // of one another.
    insetInlineStart: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    insetInlineEnd: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    position: isPinned ? 'sticky' : 'relative',
    background: isPinned ? background : undefined,
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0
  };
}

export function getFilterOperators(filterVariant: FilterVariant) {
  const operatorMap: Record<FilterVariant, { label: string; value: FilterOperator }[]> = {
    text: dataTableConfig.textOperators,
    number: dataTableConfig.numericOperators,
    range: dataTableConfig.numericOperators,
    date: dataTableConfig.dateOperators,
    dateRange: dataTableConfig.dateOperators,
    boolean: dataTableConfig.booleanOperators,
    select: dataTableConfig.selectOperators,
    multiSelect: dataTableConfig.multiSelectOperators
  };

  return operatorMap[filterVariant] ?? dataTableConfig.textOperators;
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant);

  return operators[0]?.value ?? (filterVariant === 'text' ? 'iLike' : 'eq');
}

export function getValidFilters<TData>(
  filters: ExtendedColumnFilter<TData>[]
): ExtendedColumnFilter<TData>[] {
  return filters.filter(
    (filter) =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== '' && filter.value !== null && filter.value !== undefined)
  );
}
