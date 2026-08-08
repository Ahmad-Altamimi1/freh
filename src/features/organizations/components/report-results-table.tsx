'use client';

import Link from 'next/link';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Organization, ReportColumn } from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';

const RESULTS = ORGANIZATION_LABELS.results;

/** Rows drawn per page. Paging is client-side — the report fetches the whole set. */
const PAGE_SIZE = 25;

/**
 * The matching rows, in the columns the builder selected.
 *
 * This is the page's output now that the statistics blocks are gone, and it is
 * deliberately the *same* projection the printed document uses: ticking a column
 * in "أعمدة الجدول" adds it here, so what is on screen is what will be printed.
 * That is what makes the column picker legible — previously it described a
 * document nobody could see without generating a PDF.
 *
 * Paged in the browser rather than the database. The report already fetches the
 * full result set unpaginated (it has to — a report describes every matching
 * row, not a page of them), so a server round-trip per page would refetch
 * everything to show a slice of what is already in memory.
 */
interface ReportResultsTableProps {
  rows: Organization[];
  columns: ReportColumn[];
  /** Dimmed while a new filter resolves, rather than replaced with a skeleton. */
  isFetching: boolean;
}

export function ReportResultsTable({ rows, columns, isFetching }: ReportResultsTableProps) {
  const [page, setPage] = React.useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // A narrower filter can leave the viewer on a page that no longer exists.
  // Clamping during render rather than in an effect avoids a frame of blankness.
  const currentPage = Math.min(page, pageCount - 1);
  if (currentPage !== page) setPage(currentPage);

  const visible = React.useMemo(
    () => rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [rows, currentPage]
  );

  const firstRowNumber = currentPage * PAGE_SIZE + 1;

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div>
          <CardTitle className='text-base'>{RESULTS.title}</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? ORGANIZATION_LABELS.table.noResults
              : RESULTS.showing(
                  formatNumberAr(firstRowNumber),
                  formatNumberAr(firstRowNumber + visible.length - 1),
                  formatNumberAr(rows.length)
                )}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {columns.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>{RESULTS.noColumns}</p>
        ) : rows.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {ORGANIZATION_LABELS.table.noResults}
          </p>
        ) : (
          <>
            {/* The table is the one thing here that can outgrow the viewport, so
                it scrolls inside its own box rather than making the page scroll
                sideways. */}
            <div
              className={cn(
                'overflow-x-auto rounded-md border transition-opacity',
                isFetching && 'opacity-60'
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/50'>
                    <TableHead className='text-muted-foreground w-12'>
                      {ORGANIZATION_LABELS.document.rowNumber}
                    </TableHead>
                    {columns.map((column) => (
                      <TableHead key={column} className='whitespace-nowrap'>
                        {ORGANIZATION_FIELD_LABELS[column]}
                      </TableHead>
                    ))}
                    <TableHead className='w-12'>
                      <span className='sr-only'>{ORGANIZATION_LABELS.actions.view}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row, index) => (
                    <TableRow key={row.id}>
                      {/* Position in the current result, not the stored
                          `serialNo` — that number belongs to a differently
                          ordered sheet and reads as noise once filtered. */}
                      <TableCell dir='ltr' className='text-muted-foreground tabular-nums'>
                        {formatNumberAr(firstRowNumber + index)}
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell key={column} className='align-top'>
                          <CellValue row={row} column={column} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-7'
                          nativeButton={false}
                          render={
                            <Link
                              href={`/dashboard/organizations/${row.id}`}
                              aria-label={`${ORGANIZATION_LABELS.actions.view}: ${row.name}`}
                            />
                          }
                        >
                          <Icons.chevronLeft className='size-4 rtl:rotate-180' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pageCount > 1 && (
              <div className='flex items-center justify-between gap-2 pt-3 print:hidden'>
                <p className='text-muted-foreground text-sm'>
                  {RESULTS.page(formatNumberAr(currentPage + 1), formatNumberAr(pageCount))}
                </p>
                <div className='flex items-center gap-1'>
                  {/* Named as they would be in LTR and mirrored with
                      `rtl:rotate-180` — picking the RTL-correct glyph *and*
                      rotating it would point it backwards. */}
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-8'
                    aria-label={RESULTS.previous}
                    disabled={currentPage === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    <Icons.chevronLeft className='size-4 rtl:rotate-180' />
                  </Button>
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-8'
                    aria-label={RESULTS.next}
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                  >
                    <Icons.chevronRight className='size-4 rtl:rotate-180' />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One cell, formatted the same way the printed document formats it.
 *
 * Identifiers, phone numbers, dates and durations all carry `dir='ltr'`: they
 * are left-to-right sequences even inside an RTL page, and without it the bidi
 * algorithm reorders their digit groups.
 */
function CellValue({ row, column }: { row: Organization; column: ReportColumn }) {
  switch (column) {
    case 'name':
      return <span className='font-medium'>{row.name}</span>;
    case 'serialNo':
    case 'nationalId':
    case 'mobile': {
      const value = row[column];
      return value ? (
        <span dir='ltr' className='tabular-nums'>
          {value}
        </span>
      ) : (
        <Empty />
      );
    }
    case 'establishedAt':
    case 'termStart':
    case 'termEnd': {
      const value = row[column];
      return value ? (
        <span dir='ltr' className='whitespace-nowrap'>
          {formatDateAr(value)}
        </span>
      ) : (
        <Empty />
      );
    }
    case 'termLength':
      return row.termLength != null ? (
        <span dir='ltr' className='tabular-nums'>
          {formatNumberAr(row.termLength)}
        </span>
      ) : (
        <Empty />
      );
    default:
      return row[column] ? <span>{row[column]}</span> : <Empty />;
  }
}

function Empty() {
  return <span className='text-muted-foreground'>{ORGANIZATION_LABELS.detail.empty}</span>;
}
