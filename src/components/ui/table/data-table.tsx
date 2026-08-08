import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import type * as React from 'react';

import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  /**
   * Refetching in the background — dims the rows and blocks interaction with
   * them, while leaving the toolbar above fully usable.
   *
   * Deliberately not a skeleton: the previous rows are still meaningful, and
   * replacing them wholesale makes every filter tweak feel like a page load.
   */
  isPending?: boolean;
  /** Choices for the rows-per-page control. Must include the table's default. */
  pageSizeOptions?: number[];
  /** Called when a row is clicked. Ignored for clicks on interactive elements. */
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  table,
  actionBar,
  isPending,
  pageSizeOptions,
  onRowClick,
  children
}: DataTableProps<TData>) {
  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {children}
      <div className='relative flex flex-1' aria-busy={isPending}>
        <div
          className={cn(
            'bg-card absolute inset-0 flex overflow-hidden rounded-lg border shadow-sm transition-opacity duration-200',
            isPending && 'pointer-events-none opacity-50'
          )}
        >
          <ScrollArea className='h-full w-full'>
            <Table>
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          // The header row is `bg-muted`; a pinned cell has to
                          // paint the same colour or it reads as a white patch.
                          ...getCommonPinningStyles({
                            column: header.column,
                            background: 'var(--muted)'
                          })
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={onRowClick ? 'cursor-pointer' : undefined}
                      onClick={(e) => {
                        if (!onRowClick) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('a, button, [role="checkbox"], [role="menuitem"]'))
                          return;
                        onRowClick(row.original);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonPinningStyles({ column: cell.column })
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getAllColumns().length} className='h-24 text-center'>
                      لا توجد نتائج.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation='horizontal' />
          </ScrollArea>
        </div>
      </div>
      <div className='flex flex-col gap-2.5'>
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
