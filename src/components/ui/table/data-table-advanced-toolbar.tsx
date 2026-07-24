'use client';

import type { Table } from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Toolbar for tables that filter server-side through the advanced builder.
 *
 * Distinct from `DataTableToolbar`, which renders one control per filterable
 * column and drives TanStack's own `columnFilters`. That model does not fit here:
 * the conditions live in the URL, are combined with an explicit AND/OR, and are
 * resolved by Postgres.
 *
 * Layout only — the filter builder, the search value and the actions are all
 * passed in, so this component holds no feature state and no language.
 */

interface DataTableAdvancedToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  /** Quick-search value. Controlled by the caller so it can live in the URL. */
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** The filter builder trigger. */
  filterList?: React.ReactNode;
  /** Buttons aligned to the trailing edge — export, report, and so on. */
  actions?: React.ReactNode;
}

export function DataTableAdvancedToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  filterList,
  actions,
  className,
  children,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div
      role='toolbar'
      aria-orientation='horizontal'
      className={cn('flex w-full flex-wrap items-center justify-between gap-2 p-1', className)}
      {...props}
    >
      <div className='flex flex-1 flex-wrap items-center gap-2'>
        <div className='relative'>
          <Icons.search
            aria-hidden
            className='text-muted-foreground pointer-events-none absolute inset-y-0 start-2 my-auto size-4'
          />
          <Input
            type='search'
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className='h-8 w-48 ps-8 lg:w-72'
          />
        </div>
        {filterList}
        {children}
      </div>
      <div className='flex items-center gap-2'>
        {actions}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}

/** A trailing-edge toolbar action rendered as a small outline button. */
export function DataTableToolbarAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button variant='outline' size='sm' className={cn(className)} {...props} />;
}
