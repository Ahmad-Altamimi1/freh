'use client';

import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { getDefaultFilterOperator, getFilterOperators, getValidFilters } from '@/lib/data-table';
import { RELATIVE_DATE_TOKENS, type RelativeDateToken } from '@/lib/filter-columns';
import { formatDateAr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  ExtendedColumnFilter,
  FilterOperator,
  FilterVariant,
  JoinOperator,
  Option
} from '@/types/data-table';

/**
 * Compound filter builder.
 *
 * Stacks conditions of the form `[field] [operator] [value]`, combined by a
 * single AND/OR. Modelled on the Notion/Airtable convention: the join operator
 * is chosen once on the second row and shown read-only after that, because a
 * per-row mix of AND and OR has no unambiguous reading without explicit
 * parentheses — and a filter UI that needs parentheses has stopped being usable.
 *
 * State lives entirely in the URL, owned by the caller and passed in. That is
 * what makes a filtered view shareable, restorable on reload, and reusable as
 * the definition of a report.
 *
 * Values are always stored as strings (or arrays of strings) regardless of the
 * column's type — that is the contract `filterItemSchema` in `@/lib/parsers`
 * enforces, and `@/lib/filter-columns` is what coerces them back on the server.
 * Dates in particular are stored as epoch-millisecond strings, matching the
 * template's existing `data-table-date-filter`.
 */

/** Labels the host app supplies so this component carries no language of its own. */
export interface FilterListLabels {
  trigger: string;
  empty: string;
  add: string;
  apply: string;
  reset: string;
  remove: string;
  where: string;
  selectField: string;
  selectOperator: string;
  value: string;
  from: string;
  to: string;
  operator: Record<FilterOperator, string>;
  join: Record<JoinOperator, string>;
  relativeDate: Record<RelativeDateToken, string>;
}

interface DataTableFilterListProps<TData> {
  table: Table<TData>;
  filters: ExtendedColumnFilter<TData>[];
  onFiltersChange: (filters: ExtendedColumnFilter<TData>[]) => void;
  joinOperator: JoinOperator;
  onJoinOperatorChange: (value: JoinOperator) => void;
  labels: FilterListLabels;
  align?: 'start' | 'center' | 'end';
}

/**
 * Identifies a filter row across re-renders.
 *
 * Two conditions on the same column are legitimate — "established after 2000
 * AND established before 2010" — so the column id cannot be the React key.
 * `filterId` is part of the persisted schema precisely so a row keeps its
 * identity while its column, operator and value all change underneath it.
 */
function createFilterId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getColumnVariant<TData>(column: Column<TData, unknown> | undefined): FilterVariant {
  return column?.columnDef.meta?.variant ?? 'text';
}

/** Operators that ignore their value entirely. */
function isValuelessOperator(operator: FilterOperator): boolean {
  return operator === 'isEmpty' || operator === 'isNotEmpty';
}

function parseAsDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toTimestamp(date: Date | undefined): string {
  return date ? String(date.getTime()) : '';
}

export function DataTableFilterList<TData>({
  table,
  filters,
  onFiltersChange,
  joinOperator,
  onJoinOperatorChange,
  labels,
  align = 'start'
}: DataTableFilterListProps<TData>) {
  const [open, setOpen] = React.useState(false);

  /**
   * Conditions being edited, held locally until the user commits them.
   *
   * Editing straight through to the URL means every keystroke, every operator
   * change and every empty row added is a new query key — so the table refetches
   * against half-written conditions and flickers while the user is still
   * describing what they want. The draft makes one deliberate action ("تصفية")
   * the only thing that queries.
   */
  const [draftFilters, setDraftFilters] = React.useState<ExtendedColumnFilter<TData>[]>(filters);
  const [draftJoin, setDraftJoin] = React.useState<JoinOperator>(joinOperator);

  /**
   * Re-seed the draft from the applied state when the panel opens, so it picks
   * up changes made elsewhere — a shared link, the browser's back button, or a
   * reset — rather than showing a stale draft.
   *
   * The applied state is read through a ref, and the effect depends on `open`
   * alone. Depending on `filters` directly would re-seed on every change of that
   * array's identity: applying inside the open panel feeds a new array straight
   * back in, and any render that produced a fresh reference would wipe whatever
   * the user was midway through typing.
   */
  const appliedRef = React.useRef({ filters, joinOperator });
  appliedRef.current = { filters, joinOperator };

  React.useEffect(() => {
    if (!open) return;
    setDraftFilters(appliedRef.current.filters);
    setDraftJoin(appliedRef.current.joinOperator);
  }, [open]);

  const filterableColumns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.columnDef.enableColumnFilter),
    [table]
  );

  const updateFilter = React.useCallback(
    (filterId: string, patch: Partial<ExtendedColumnFilter<TData>>) => {
      setDraftFilters((previous) =>
        previous.map((filter) => (filter.filterId === filterId ? { ...filter, ...patch } : filter))
      );
    },
    []
  );

  const removeFilter = React.useCallback((filterId: string) => {
    setDraftFilters((previous) => previous.filter((filter) => filter.filterId !== filterId));
  }, []);

  const addFilter = React.useCallback(() => {
    const column = filterableColumns[0];
    if (!column) return;

    const variant = getColumnVariant(column);

    setDraftFilters((previous) => [
      ...previous,
      {
        id: column.id as Extract<keyof TData, string>,
        value: '',
        variant,
        operator: getDefaultFilterOperator(variant),
        filterId: createFilterId()
      }
    ]);
  }, [filterableColumns]);

  /**
   * Commits the draft. Deliberately does not close the panel — narrowing a
   * result set is iterative, and reopening the builder after every attempt to
   * see what it did makes that painful.
   */
  const applyFilters = React.useCallback(() => {
    // Rows the user added but never filled in would be dropped server-side
    // anyway; removing them here keeps the URL and the panel honest about what
    // is actually in effect.
    const usable = getValidFilters(draftFilters) as ExtendedColumnFilter<TData>[];
    setDraftFilters(usable);
    onJoinOperatorChange(draftJoin);
    onFiltersChange(usable);
  }, [draftFilters, draftJoin, onFiltersChange, onJoinOperatorChange]);

  /** Clearing is unambiguous, so it commits immediately rather than staging. */
  const resetFilters = React.useCallback(() => {
    setDraftFilters([]);
    setDraftJoin('and');
    onJoinOperatorChange('and');
    onFiltersChange([]);
  }, [onFiltersChange, onJoinOperatorChange]);

  /** Whether the draft differs from what the table is currently showing. */
  const isDirty = React.useMemo(
    () =>
      draftJoin !== joinOperator ||
      JSON.stringify(getValidFilters(draftFilters)) !== JSON.stringify(getValidFilters(filters)),
    [draftFilters, draftJoin, filters, joinOperator]
  );

  /**
   * Switching the column resets the operator and value: an operator valid for a
   * date ("is between") is meaningless on a multi-select, and carrying the old
   * value over would silently produce a condition the user never described.
   */
  const changeFilterColumn = React.useCallback(
    (filterId: string, columnId: string) => {
      const column = table.getColumn(columnId);
      const variant = getColumnVariant(column);

      updateFilter(filterId, {
        id: columnId as Extract<keyof TData, string>,
        variant,
        operator: getDefaultFilterOperator(variant),
        value: ''
      });
    },
    [table, updateFilter]
  );

  /** Changing to or from a valueless operator must not strand a stale value. */
  const changeFilterOperator = React.useCallback((filterId: string, operator: FilterOperator) => {
    setDraftFilters((previous) =>
      previous.map((filter) => {
        if (filter.filterId !== filterId) return filter;

        const wasValueless = isValuelessOperator(filter.operator);
        const nowValueless = isValuelessOperator(operator);
        const changesArity =
          operator === 'isBetween' ||
          filter.operator === 'isBetween' ||
          operator === 'isRelativeToToday' ||
          filter.operator === 'isRelativeToToday';

        return {
          ...filter,
          operator,
          ...(nowValueless || wasValueless || changesArity ? { value: '' } : {})
        };
      })
    );
  }, []);

  // The badge counts what is applied, not what is being drafted — it describes
  // the table beside it.
  const activeCount = getValidFilters(filters).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant='outline' size='sm' className='border-dashed' />}>
        <Icons.filter />
        {labels.trigger}
        {activeCount > 0 && (
          <Badge variant='secondary' className='rounded-sm px-1 font-normal tabular-nums'>
            {activeCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className='flex w-[min(36rem,calc(100vw-2rem))] flex-col gap-2 p-4'
      >
        {draftFilters.length === 0 ? (
          <p className='text-muted-foreground py-2 text-sm'>{labels.empty}</p>
        ) : (
          <div className='flex max-h-[26rem] flex-col gap-2 overflow-y-auto'>
            {draftFilters.map((filter, index) => (
              <FilterRow
                key={filter.filterId}
                filter={filter}
                index={index}
                joinOperator={draftJoin}
                onJoinOperatorChange={setDraftJoin}
                columns={filterableColumns}
                labels={labels}
                onColumnChange={(columnId) => changeFilterColumn(filter.filterId, columnId)}
                onOperatorChange={(operator) => changeFilterOperator(filter.filterId, operator)}
                onValueChange={(value) => updateFilter(filter.filterId, { value })}
                onRemove={() => removeFilter(filter.filterId)}
              />
            ))}
          </div>
        )}

        <div className='flex items-center gap-2 pt-1'>
          <Button variant='outline' size='sm' onClick={addFilter}>
            <Icons.add />
            {labels.add}
          </Button>
          <Button size='sm' onClick={applyFilters} disabled={!isDirty}>
            <Icons.filter />
            {labels.apply}
          </Button>
          {(draftFilters.length > 0 || activeCount > 0) && (
            <Button variant='ghost' size='sm' onClick={resetFilters}>
              {labels.reset}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FilterRowProps<TData> {
  filter: ExtendedColumnFilter<TData>;
  index: number;
  joinOperator: JoinOperator;
  onJoinOperatorChange: (value: JoinOperator) => void;
  columns: Column<TData, unknown>[];
  labels: FilterListLabels;
  onColumnChange: (columnId: string) => void;
  onOperatorChange: (operator: FilterOperator) => void;
  onValueChange: (value: string | string[]) => void;
  onRemove: () => void;
}

function FilterRow<TData>({
  filter,
  index,
  joinOperator,
  onJoinOperatorChange,
  columns,
  labels,
  onColumnChange,
  onOperatorChange,
  onValueChange,
  onRemove
}: FilterRowProps<TData>) {
  const operators = React.useMemo(() => getFilterOperators(filter.variant), [filter.variant]);

  const activeColumn = React.useMemo(
    () => columns.find((column) => column.id === filter.id),
    [columns, filter.id]
  );

  return (
    <div className='flex items-center gap-2'>
      {/* The leading slot keeps every row's controls on the same vertical
          grid — without a fixed width the selects would step sideways. */}
      <div className='w-16 shrink-0 text-sm'>
        {index === 0 ? (
          <span className='text-muted-foreground'>{labels.where}</span>
        ) : index === 1 ? (
          <Select
            value={joinOperator}
            onValueChange={(value) => value && onJoinOperatorChange(value as JoinOperator)}
          >
            <SelectTrigger size='sm' className='w-full'>
              <SelectValue>
                {(value: JoinOperator | null) => (value ? labels.join[value] : labels.join.and)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='and'>{labels.join.and}</SelectItem>
              <SelectItem value='or'>{labels.join.or}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className='text-muted-foreground'>{labels.join[joinOperator]}</span>
        )}
      </div>

      {/*
        `SelectValue` renders the raw selected *value* unless it is given a
        formatter — which is why the closed trigger would otherwise read
        "name" and "iLike" instead of "اسم الجمعية" and "يحتوي على". The item
        children only style the open list.

        base-ui can also emit null when a selection is cleared; the builder has
        no "no column" state, so null is ignored.
      */}
      <Select value={filter.id as string} onValueChange={(value) => value && onColumnChange(value)}>
        <SelectTrigger size='sm' className='w-40 shrink-0'>
          <SelectValue placeholder={labels.selectField}>
            {(value: string | null) =>
              columns.find((column) => column.id === value)?.columnDef.meta?.label ??
              value ??
              labels.selectField
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.columnDef.meta?.label ?? column.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value) => value && onOperatorChange(value as FilterOperator)}
      >
        <SelectTrigger size='sm' className='w-36 shrink-0'>
          <SelectValue placeholder={labels.selectOperator}>
            {(value: FilterOperator | null) =>
              (value && labels.operator[value]) ?? labels.selectOperator
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem key={operator.value} value={operator.value}>
              {labels.operator[operator.value] ?? operator.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className='min-w-0 flex-1'>
        <FilterValueInput
          filter={filter}
          options={activeColumn?.columnDef.meta?.options ?? []}
          labels={labels}
          onValueChange={onValueChange}
        />
      </div>

      <Button
        variant='ghost'
        size='icon'
        className='size-8 shrink-0'
        aria-label={labels.remove}
        onClick={onRemove}
      >
        <Icons.close />
      </Button>
    </div>
  );
}

interface FilterValueInputProps<TData> {
  filter: ExtendedColumnFilter<TData>;
  /** Choices for select/multiSelect variants, read from the column's meta. */
  options: Option[];
  labels: FilterListLabels;
  onValueChange: (value: string | string[]) => void;
}

/** Renders the input appropriate to the column's variant and the chosen operator. */
function FilterValueInput<TData>({
  filter,
  options,
  labels,
  onValueChange
}: FilterValueInputProps<TData>) {
  const { variant, operator, value } = filter;

  if (isValuelessOperator(operator)) {
    return <div className='h-8' aria-hidden />;
  }

  if (operator === 'isRelativeToToday') {
    return (
      <Select
        value={Array.isArray(value) ? (value[0] ?? '') : value}
        onValueChange={(next) => onValueChange(next ?? '')}
      >
        <SelectTrigger size='sm' className='w-full'>
          <SelectValue placeholder={labels.value}>
            {(token: RelativeDateToken | null) =>
              (token && labels.relativeDate[token]) ?? labels.value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {RELATIVE_DATE_TOKENS.map((token) => (
            <SelectItem key={token} value={token}>
              {labels.relativeDate[token]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === 'date' || variant === 'dateRange') {
    return (
      <DateValueInput
        value={value}
        range={operator === 'isBetween'}
        labels={labels}
        onValueChange={onValueChange}
      />
    );
  }

  if (variant === 'select' || variant === 'multiSelect') {
    return (
      <OptionsValueInput
        filter={filter}
        options={options}
        labels={labels}
        onValueChange={onValueChange}
      />
    );
  }

  if (operator === 'isBetween') {
    const [from = '', to = ''] = Array.isArray(value) ? value : [value, ''];
    return (
      <div className='flex items-center gap-1'>
        <Input
          type='number'
          inputMode='numeric'
          className='h-8'
          placeholder={labels.from}
          value={from}
          onChange={(event) => onValueChange([event.target.value, to])}
        />
        <Input
          type='number'
          inputMode='numeric'
          className='h-8'
          placeholder={labels.to}
          value={to}
          onChange={(event) => onValueChange([from, event.target.value])}
        />
      </div>
    );
  }

  const isNumeric = variant === 'number' || variant === 'range';

  return (
    <Input
      type={isNumeric ? 'number' : 'text'}
      inputMode={isNumeric ? 'numeric' : undefined}
      className='h-8'
      placeholder={labels.value}
      value={Array.isArray(value) ? (value[0] ?? '') : value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}

function DateValueInput({
  value,
  range,
  labels,
  onValueChange
}: {
  value: string | string[];
  range: boolean;
  labels: FilterListLabels;
  onValueChange: (value: string | string[]) => void;
}) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const from = parseAsDate(values[0]);
  const to = parseAsDate(values[1]);

  const display = range
    ? from || to
      ? `${from ? formatDateAr(from, { month: 'short' }) : '…'} – ${to ? formatDateAr(to, { month: 'short' }) : '…'}`
      : labels.value
    : from
      ? formatDateAr(from, { month: 'short' })
      : labels.value;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            className={cn(
              'h-8 w-full justify-start font-normal',
              !from && !to && 'text-muted-foreground'
            )}
          />
        }
      >
        <Icons.calendar />
        <span className='truncate'>{display}</span>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        {range ? (
          <Calendar
            mode='range'
            selected={{ from, to }}
            onSelect={(selected: DateRange | undefined) =>
              onValueChange([toTimestamp(selected?.from), toTimestamp(selected?.to)])
            }
          />
        ) : (
          <Calendar
            mode='single'
            selected={from}
            onSelect={(selected: Date | undefined) => onValueChange(toTimestamp(selected))}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function OptionsValueInput<TData>({
  filter,
  options: columnOptions,
  labels,
  onValueChange
}: FilterValueInputProps<TData>) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => new Set(Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : []),
    [filter.value]
  );

  const multiple = filter.variant === 'multiSelect';

  const toggle = (optionValue: string) => {
    if (!multiple) {
      onValueChange(selected.has(optionValue) ? '' : [optionValue]);
      setOpen(false);
      return;
    }

    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    onValueChange(Array.from(next));
  };

  const label =
    selected.size === 0
      ? labels.value
      : selected.size <= 2
        ? columnOptions
            .filter((option) => selected.has(option.value))
            .map((option) => option.label)
            .join('، ')
        : `${selected.size}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            className={cn(
              'h-8 w-full justify-start font-normal',
              selected.size === 0 && 'text-muted-foreground'
            )}
          />
        }
      >
        <span className='truncate'>{label}</span>
      </PopoverTrigger>
      <PopoverContent className='w-56 p-0' align='start'>
        <Command>
          <CommandInput placeholder={labels.value} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup className='max-h-64 overflow-y-auto'>
              {columnOptions.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Icons.check />
                    </div>
                    <span className='truncate'>{option.label}</span>
                    {option.count !== undefined && (
                      <span className='text-muted-foreground ms-auto text-xs tabular-nums'>
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
