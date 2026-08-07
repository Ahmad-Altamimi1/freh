'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
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
import { normalizeArabic } from '@/lib/arabic';
import { cn } from '@/lib/utils';
import type { Option } from '@/types/data-table';

interface ComboboxProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A generic searchable select — Popover + Command, promoted from the static
 * demo in `demo-form.tsx` into something reusable and data-driven.
 *
 * Two details that matter and are easy to get wrong by copying that demo
 * literally:
 *
 * 1. `Command`'s default filter is raw substring matching, which fails on
 *    Arabic spelling variants (hamza carriers, taa marbuta) — the exact
 *    problem `normalizeArabic()` exists to solve app-wide. This app is
 *    Arabic-only, so the filter is normalized here rather than left for every
 *    caller to remember.
 * 2. `CommandItem`'s `value` prop is what cmdk matches and filters against —
 *    not its rendered children. It must be the option's `label` (what a
 *    person types), never its `value` (often an opaque id nobody could type).
 *    `onSelect` therefore ignores the string cmdk hands back and calls
 *    `onChange` with the closed-over option's own `value` instead.
 */
export function Combobox({
  options,
  value,
  onChange,
  onBlur,
  placeholder = 'اختر…',
  searchPlaceholder = 'ابحث…',
  emptyText = 'لا توجد نتائج.',
  disabled,
  className
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={disabled}
            onBlur={onBlur}
            className={cn('w-full justify-between font-normal', className)}
          />
        }
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <Icons.chevronsUpDown className='size-4 shrink-0 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-(--anchor-width) p-0'>
        <Command
          filter={(itemValue, search) =>
            normalizeArabic(itemValue).includes(normalizeArabic(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Icons.check
                    className={cn(
                      'me-2 size-4',
                      option.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
