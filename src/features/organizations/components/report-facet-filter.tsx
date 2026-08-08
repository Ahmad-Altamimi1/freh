'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { formatNumberAr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Option } from '@/types/data-table';
import { ORGANIZATION_LABELS } from '../constants/labels';

const FILTERS = ORGANIZATION_LABELS.filters;

/**
 * A one-click picker over the values a column actually holds.
 *
 * The advanced builder can express the same condition, but getting there costs
 * three controls — pick the column, pick "أحد الخيارات", then open a second
 * popover nested inside the first — and until the operator happens to be right
 * the list of districts is not reachable at all. Choosing which of eight
 * districts to report on is the most common thing anyone does on this page, so
 * it gets a control of its own: the values are on screen with their counts, and
 * ticking several is the default rather than a capability to discover.
 *
 * Writes straight through to the URL instead of staging a draft. A tick is
 * unambiguous in a way a half-typed condition is not — there is nothing to
 * confirm — and the count updates as fast as the tick.
 */
interface ReportFacetFilterProps {
  label: string;
  /** Distinct values with their row counts, from the facets query. */
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function ReportFacetFilter({ label, options, selected, onChange }: ReportFacetFilterProps) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Ordered by the option list rather than by click order, so the pill in the
    // bar and the criteria on the printed page read the same way every time.
    onChange(options.filter((option) => next.has(option.value)).map((option) => option.value));
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant='outline' size='sm' className='border-dashed' />}>
        <Icons.add className='size-3.5' />
        {label}
        {selected.length > 0 && (
          <>
            <Separator orientation='vertical' className='mx-1 h-4' />
            {selected.length <= 2 ? (
              selected.map((value) => (
                <Badge key={value} variant='secondary' className='rounded-sm px-1 font-normal'>
                  {value}
                </Badge>
              ))
            ) : (
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal tabular-nums'
                dir='ltr'
              >
                {formatNumberAr(selected.length)}
              </Badge>
            )}
          </>
        )}
      </PopoverTrigger>

      <PopoverContent className='w-60 p-0' align='start'>
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>{ORGANIZATION_LABELS.table.noResults}</CommandEmpty>
            <CommandGroup className='max-h-72 overflow-y-auto'>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Icons.check className='size-3' />
                    </div>
                    <span className='truncate'>{option.label}</span>
                    {option.count !== undefined && (
                      <span
                        dir='ltr'
                        className='text-muted-foreground ms-auto text-xs tabular-nums'
                      >
                        {formatNumberAr(option.count)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <CommandGroup className='border-t'>
                <CommandItem onSelect={() => onChange([])} className='justify-center text-sm'>
                  {FILTERS.clearAll}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
