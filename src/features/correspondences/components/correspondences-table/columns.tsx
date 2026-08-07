'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import { formatDateAr } from '@/lib/format';
import type { Option } from '@/types/data-table';
import type { Correspondence } from '../../api/types';
import {
  CORRESPONDENCE_FIELD_LABELS,
  CORRESPONDENCE_LABELS,
  CORRESPONDENCE_TYPE_BADGE_VARIANT,
  CORRESPONDENCE_TYPE_OPTIONS
} from '../../constants/labels';
import { CellAction } from './cell-action';

/**
 * Column definitions for the correspondences table.
 *
 * `meta.variant` is load-bearing: it is what the advanced filter builder reads
 * to decide which operators and which value input a column gets. Organization
 * options are injected from a facets query, the same way organizations'
 * district/classification columns work — a new organization becomes
 * filterable the moment it has a correspondence, with no code change.
 */
export function getCorrespondenceColumns({
  organizationOptions,
  canEdit
}: {
  organizationOptions: Option[];
  /**
   * Whether to render the row-actions column. Presentation only — the
   * mutations re-check the role server-side, since a Server Action is
   * reachable by POST whether or not a menu was ever rendered.
   */
  canEdit: boolean;
}): ColumnDef<Correspondence>[] {
  return [
    {
      // Position in the current result, computed in the browser — see
      // organizations' own `rowNumber` column for why.
      id: 'rowNumber',
      header: () => <span className='text-muted-foreground'>#</span>,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return (
          <span className='text-muted-foreground tabular-nums'>
            {pageIndex * pageSize + row.index + 1}
          </span>
        );
      },
      size: 56,
      enableSorting: false,
      enableHiding: false
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }: { column: Column<Correspondence, unknown> }) => (
        <DataTableColumnHeader column={column} title={CORRESPONDENCE_FIELD_LABELS.name} />
      ),
      cell: ({ cell }) => (
        <span className='font-medium'>{cell.getValue<Correspondence['name']>()}</span>
      ),
      size: 320,
      meta: {
        label: CORRESPONDENCE_FIELD_LABELS.name,
        placeholder: 'ابحث بالاسم…',
        variant: 'text',
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: ({ column }: { column: Column<Correspondence, unknown> }) => (
        <DataTableColumnHeader column={column} title={CORRESPONDENCE_FIELD_LABELS.type} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Correspondence['type']>();
        return <Badge variant={CORRESPONDENCE_TYPE_BADGE_VARIANT[value]}>{value}</Badge>;
      },
      meta: {
        label: CORRESPONDENCE_FIELD_LABELS.type,
        variant: 'multiSelect',
        options: CORRESPONDENCE_TYPE_OPTIONS
      },
      enableColumnFilter: true
    },
    {
      id: 'organizationId',
      accessorKey: 'organizationId',
      header: ({ column }: { column: Column<Correspondence, unknown> }) => (
        <DataTableColumnHeader column={column} title={CORRESPONDENCE_FIELD_LABELS.organizationId} />
      ),
      cell: ({ row }) => row.original.organizationName,
      meta: {
        label: CORRESPONDENCE_FIELD_LABELS.organizationId,
        variant: 'multiSelect',
        options: organizationOptions
      },
      enableColumnFilter: true
    },
    {
      // Display-only — no filter/sort needed for a count, and a signed-URL
      // round trip isn't worth it just to show how many files there are.
      id: 'files',
      header: () => <span>{CORRESPONDENCE_FIELD_LABELS.files}</span>,
      cell: ({ row }) => {
        const count = row.original.files.length;
        if (count === 0) return <span className='text-muted-foreground'>—</span>;
        return (
          <Badge variant='outline' className='gap-1'>
            <Icons.paperclip className='size-3' />
            {count}
          </Badge>
        );
      },
      enableSorting: false,
      enableColumnFilter: false
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }: { column: Column<Correspondence, unknown> }) => (
        <DataTableColumnHeader column={column} title={CORRESPONDENCE_FIELD_LABELS.createdAt} />
      ),
      cell: ({ cell }) => (
        <span className='whitespace-nowrap'>
          {formatDateAr(cell.getValue<Correspondence['createdAt']>())}
        </span>
      ),
      meta: {
        label: CORRESPONDENCE_FIELD_LABELS.createdAt,
        variant: 'dateRange',
        icon: Icons.calendar
      },
      enableColumnFilter: true
    },
    // Appended conditionally rather than rendered empty, so the column does
    // not occupy width — or appear in the column-visibility menu — for a
    // user who cannot act on it.
    ...(canEdit
      ? ([
          {
            id: 'actions',
            header: () => (
              <span className='sr-only'>{CORRESPONDENCE_LABELS.actions.rowActions}</span>
            ),
            cell: ({ row }) => <CellAction data={row.original} />,
            size: 56,
            enableSorting: false,
            enableHiding: false
          }
        ] satisfies ColumnDef<Correspondence>[])
      : [])
  ];
}
