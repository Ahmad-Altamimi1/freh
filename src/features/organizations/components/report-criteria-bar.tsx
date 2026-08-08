'use client';

import type { Table } from '@tanstack/react-table';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableFilterList } from '@/components/ui/table/data-table-filter-list';
import { formatNumberAr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExtendedColumnFilter, JoinOperator } from '@/types/data-table';
import type { FilterChip } from '../api/describe-filters';
import type { Organization } from '../api/types';
import { ORGANIZATION_FILTER_LABELS } from '../constants/filter-labels';
import { JOIN_OPERATOR_LABELS, ORGANIZATION_LABELS } from '../constants/labels';

const FILTERS = ORGANIZATION_LABELS.filters;
const BUILDER = ORGANIZATION_LABELS.builder;

/**
 * The report's criteria, edited in place.
 *
 * Replaces the read-only summary card that used to send the user back to the
 * listing to change anything. Two rows, and the second only exists when it has
 * something to say:
 *
 *   1. The controls — quick search, the builder's trigger, the live count.
 *   2. The active conditions as removable pills, joined by an editable و/أو.
 *
 * The pills are the part worth having. A compound filter kept behind a popover
 * is invisible: the page shows a number with no statement of what it counts, and
 * the only way to find out is to reopen the panel. Surfacing each condition as
 * its own pill makes the filter readable at a glance and removable in one click
 * — the Linear/Notion convention — while the popover stays the place where a
 * condition is *composed*, which is where the room for three controls is needed.
 */
interface ReportCriteriaBarProps {
  /**
   * A headless table instance, present only to describe the filterable columns.
   * `DataTableFilterList` reads its operators, variants and option lists from
   * the column definitions, so reusing the listing's columns is what keeps the
   * two screens offering the same filter.
   */
  table: Table<Organization>;
  search: string;
  onSearchChange: (value: string) => void;
  filters: ExtendedColumnFilter<Organization>[];
  onFiltersChange: (filters: ExtendedColumnFilter<Organization>[]) => void;
  joinOperator: JoinOperator;
  onJoinOperatorChange: (value: JoinOperator) => void;
  chips: FilterChip[];
  onRemoveChip: (id: string) => void;
  onClearAll: () => void;
  /** Rows matching the criteria; `undefined` until the first count arrives. */
  total: number | undefined;
  isFetching: boolean;
  /** Trailing-edge controls — the back link, exports. */
  actions?: React.ReactNode;
}

export function ReportCriteriaBar({
  table,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  joinOperator,
  onJoinOperatorChange,
  chips,
  onRemoveChip,
  onClearAll,
  total,
  isFetching,
  actions
}: ReportCriteriaBarProps) {
  // The search reads as a condition to the user but is a separate URL param, so
  // it is split back out here to be rendered first and joined with a fixed "و" —
  // the server always ANDs it, whatever the conditions' own join operator is.
  const searchChip = chips.find((chip) => chip.id === 'q');
  const conditionChips = chips.filter((chip) => chip.id !== 'q');

  // `print:hidden` because these are controls, not report content. A browser
  // print gets the criteria from `AppliedFiltersForPrint` instead, which is the
  // same block the old applied-filters card printed.
  return (
    <section
      aria-label={BUILDER.criteria}
      className='bg-card overflow-hidden rounded-xl border shadow-xs print:hidden'
    >
      <div className='flex flex-wrap items-center gap-2 p-3'>
        <div className='relative min-w-0 flex-1 sm:max-w-xs'>
          <Icons.search
            aria-hidden
            className='text-muted-foreground pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4'
          />
          <Input
            type='search'
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={ORGANIZATION_LABELS.table.search}
            aria-label={ORGANIZATION_LABELS.table.search}
            className='h-9 ps-8'
          />
        </div>

        <DataTableFilterList
          table={table}
          filters={filters}
          onFiltersChange={onFiltersChange}
          joinOperator={joinOperator}
          onJoinOperatorChange={onJoinOperatorChange}
          labels={ORGANIZATION_FILTER_LABELS}
        />

        <div className='ms-auto flex items-center gap-3'>
          {/* The count is the filter's feedback, so it lives beside the controls
              rather than only inside the report below the fold. */}
          <p className='flex items-baseline gap-1.5' aria-busy={isFetching}>
            <span
              dir='ltr'
              className={cn(
                'text-lg leading-none font-semibold tabular-nums transition-colors',
                isFetching && 'text-muted-foreground'
              )}
            >
              {total === undefined ? '—' : formatNumberAr(total)}
            </span>
            <span className='text-muted-foreground text-xs'>{BUILDER.matching}</span>
          </p>
          {actions}
        </div>
      </div>

      {/* Only rendered once there is something to render — an empty pill row is
          a border and a paragraph saying nothing happened. */}
      {chips.length > 0 && (
        <div className='bg-muted/30 flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5'>
          <span className='text-muted-foreground me-0.5 text-xs'>{FILTERS.where}</span>

          {searchChip && (
            <FilterPill chip={searchChip} onRemove={() => onRemoveChip(searchChip.id)} />
          )}

          {conditionChips.map((chip, index) => (
            <React.Fragment key={chip.id}>
              {/* Between the first two conditions the join is a control; after
                  that it is repeated as plain text, because one filter carries a
                  single operator and offering the same choice three times would
                  imply a precedence the model does not have. */}
              {index === 0 ? (
                searchChip && <JoinWord value='and' />
              ) : index === 1 ? (
                <JoinToggle value={joinOperator} onChange={onJoinOperatorChange} />
              ) : (
                <JoinWord value={joinOperator} />
              )}
              <FilterPill chip={chip} onRemove={() => onRemoveChip(chip.id)} />
            </React.Fragment>
          ))}

          <Button
            variant='ghost'
            size='sm'
            onClick={onClearAll}
            className='text-muted-foreground hover:text-foreground ms-1 h-7 px-2 text-xs'
          >
            {FILTERS.clearAll}
          </Button>
        </div>
      )}
    </section>
  );
}

/** One active condition: field, operator, value, and a control that drops it. */
function FilterPill({ chip, onRemove }: { chip: FilterChip; onRemove: () => void }) {
  return (
    <span className='bg-background inline-flex max-w-full items-center gap-1.5 rounded-md border py-1 ps-2 pe-1 text-xs'>
      <span className='text-muted-foreground shrink-0'>{chip.field}</span>
      <span className='text-muted-foreground/60 shrink-0'>{chip.operator}</span>
      {chip.value && (
        // `dir='auto'` rather than a fixed direction: a value may be an Arabic
        // district name or a phone number, and the bidi algorithm gets the
        // second one wrong under an inherited RTL context.
        <span dir='auto' className='min-w-0 truncate font-medium'>
          {chip.value}
        </span>
      )}
      <button
        type='button'
        onClick={onRemove}
        aria-label={`${FILTERS.remove}: ${chip.field}`}
        className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring/50 grid size-4 shrink-0 place-items-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'
      >
        <Icons.close className='size-3' />
      </button>
    </span>
  );
}

function JoinWord({ value }: { value: JoinOperator }) {
  return <span className='text-muted-foreground px-1 text-xs'>{JOIN_OPERATOR_LABELS[value]}</span>;
}

function JoinToggle({
  value,
  onChange
}: {
  value: JoinOperator;
  onChange: (value: JoinOperator) => void;
}) {
  return (
    <button
      type='button'
      onClick={() => onChange(value === 'and' ? 'or' : 'and')}
      aria-label={FILTERS.joinToggle}
      className='text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:ring-ring/50 rounded-md border border-dashed px-1.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none'
    >
      {JOIN_OPERATOR_LABELS[value]}
    </button>
  );
}
