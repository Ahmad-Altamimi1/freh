import type { Table } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 15, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const totalCount = table.getFilteredRowModel().rows.length;

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-2 overflow-auto p-1 sm:gap-8',
        className
      )}
      {...props}
    >
      <div className='text-muted-foreground text-sm whitespace-nowrap'>
        {selectedCount > 0 ? (
          <>
            تم تحديد {selectedCount} من {totalCount}
          </>
        ) : (
          <>{totalCount} صف في هذه الصفحة</>
        )}
      </div>
      <div className='flex items-center gap-2 sm:gap-6 lg:gap-8'>
        <div className='hidden items-center gap-2 sm:flex'>
          <p className='text-sm font-medium whitespace-nowrap'>صفوف لكل صفحة</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              if (value) table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className='h-8 w-[4.5rem] [&[data-size]]:h-8'>
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center justify-center text-sm font-medium whitespace-nowrap'>
          صفحة {table.getState().pagination.pageIndex + 1} من {Math.max(1, table.getPageCount())}
        </div>
        {/*
          The chevrons are rotated rather than swapped. "Previous" must point
          toward the start of the reading direction, which on an RTL page is the
          right — so the same icon means the same thing in both directions and
          there is no pair of components to keep in sync.
        */}
        <div className='flex items-center gap-1'>
          <Button
            aria-label='الانتقال إلى الصفحة الأولى'
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronsLeft className='rtl:rotate-180' />
          </Button>
          <Button
            aria-label='الصفحة السابقة'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronLeft className='rtl:rotate-180' />
          </Button>
          <Button
            aria-label='الصفحة التالية'
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronRight className='rtl:rotate-180' />
          </Button>
          <Button
            aria-label='الانتقال إلى الصفحة الأخيرة'
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronsRight className='rtl:rotate-180' />
          </Button>
        </div>
      </div>
    </div>
  );
}
