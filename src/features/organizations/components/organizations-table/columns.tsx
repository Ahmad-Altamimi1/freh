'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import type { Option } from '@/types/data-table';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../../constants/labels';
import type { Organization } from '../../api/types';
import { CellAction } from './cell-action';

/**
 * Column definitions for the organizations table.
 *
 * `meta.variant` is load-bearing: it is what the advanced filter builder reads
 * to decide which operators and which value input a column gets. A column
 * without it cannot be filtered.
 *
 * District and classification options are injected rather than hardcoded — they
 * come from a facets query, so a value introduced by a later import becomes
 * filterable with no code change.
 */
export function getOrganizationColumns({
  districtOptions,
  classificationOptions,
  canEdit
}: {
  districtOptions: Option[];
  classificationOptions: Option[];
  /**
   * Whether to render the row-actions column. Presentation only — the mutations
   * re-check the role server-side, since a Server Action is reachable by POST
   * whether or not a menu was ever rendered.
   */
  canEdit: boolean;
}): ColumnDef<Organization>[] {
  return [
    {
      /**
       * Position in the current result, computed in the browser.
       *
       * This replaces the source `serialNo` (`txtNum` in the Access export).
       * That value is a row number from a differently-ordered sheet, so once the
       * table is sorted by name — or filtered at all — it reads as noise:
       * 104, 136, 24, 23. A counter that follows the visible order is what the
       * column was being read as anyway.
       *
       * `serialNo` is still stored, imported and exported; it is simply not
       * something to show, since it only means anything in its original order.
       *
       * Pagination is server-side, so `row.index` restarts at 0 on every page
       * and the page offset has to be added back.
       */
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
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.name} />
      ),
      cell: ({ cell }) => (
        <span className='font-medium'>{cell.getValue<Organization['name']>()}</span>
      ),
      size: 320,
      meta: {
        label: ORGANIZATION_FIELD_LABELS.name,
        placeholder: 'ابحث بالاسم…',
        variant: 'text',
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      id: 'district',
      accessorKey: 'district',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.district} />
      ),
      cell: ({ cell }) => (
        <Badge variant='outline'>{cell.getValue<Organization['district']>()}</Badge>
      ),
      meta: {
        label: ORGANIZATION_FIELD_LABELS.district,
        variant: 'multiSelect',
        options: districtOptions
      },
      enableColumnFilter: true
    },
    {
      id: 'classification',
      accessorKey: 'classification',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.classification} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['classification']>();
        if (!value) return <span className='text-muted-foreground'>—</span>;
        return <Badge variant='secondary'>{value}</Badge>;
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.classification,
        variant: 'multiSelect',
        options: classificationOptions
      },
      enableColumnFilter: true
    },
    {
      id: 'nationalId',
      accessorKey: 'nationalId',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.nationalId} />
      ),
      // `dir='ltr'` because an identifier is a left-to-right sequence even inside
      // an RTL page; without it the bidi algorithm can reorder digit groups.
      cell: ({ cell }) => (
        <span dir='ltr' className='tabular-nums'>
          {cell.getValue<Organization['nationalId']>() ?? '—'}
        </span>
      ),
      meta: {
        label: ORGANIZATION_FIELD_LABELS.nationalId,
        placeholder: 'الرقم الوطني…',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'establishedAt',
      accessorKey: 'establishedAt',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.establishedAt} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['establishedAt']>();
        return value ? (
          <span className='whitespace-nowrap'>{formatDateAr(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.establishedAt,
        variant: 'dateRange',
        icon: Icons.calendar
      },
      enableColumnFilter: true
    },
    {
      id: 'termStart',
      accessorKey: 'termStart',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.termStart} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['termStart']>();
        return value ? (
          <span className='whitespace-nowrap'>{formatDateAr(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.termStart,
        variant: 'dateRange',
        icon: Icons.calendar
      },
      enableColumnFilter: true
    },
    {
      id: 'termEnd',
      accessorKey: 'termEnd',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.termEnd} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['termEnd']>();
        return value ? (
          <span className='whitespace-nowrap'>{formatDateAr(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.termEnd,
        variant: 'dateRange',
        icon: Icons.calendar
      },
      enableColumnFilter: true
    },
    {
      id: 'termLength',
      accessorKey: 'termLength',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.termLength} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['termLength']>();
        return value ? (
          <span dir='ltr' className='tabular-nums'>
            {formatNumberAr(value)}
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.termLength,
        variant: 'number'
      },
      enableColumnFilter: true
    },
    {
      id: 'directorName',
      accessorKey: 'directorName',
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.directorName} />
      ),
      cell: ({ cell }) => cell.getValue<Organization['directorName']>() ?? '—',
      meta: {
        label: ORGANIZATION_FIELD_LABELS.directorName,
        placeholder: 'اسم المدير…',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'mobile',
      accessorKey: 'mobile',
      enableSorting: false,
      header: ({ column }: { column: Column<Organization, unknown> }) => (
        <DataTableColumnHeader column={column} title={ORGANIZATION_FIELD_LABELS.mobile} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<Organization['mobile']>();
        if (!value) return <span className='text-muted-foreground'>—</span>;
        return (
          <a dir='ltr' href={`tel:${value}`} className='tabular-nums hover:underline'>
            {value}
          </a>
        );
      },
      meta: {
        label: ORGANIZATION_FIELD_LABELS.mobile,
        placeholder: 'رقم الهاتف…',
        variant: 'text'
      },
      enableColumnFilter: true
    },
    // Appended conditionally rather than rendered empty, so the column does not
    // occupy width — or appear in the column-visibility menu — for a user who
    // cannot act on it.
    ...(canEdit
      ? ([
          {
            id: 'actions',
            header: () => <span className='sr-only'>{ORGANIZATION_LABELS.actions.rowActions}</span>,
            cell: ({ row }) => <CellAction data={row.original} />,
            size: 56,
            enableSorting: false,
            enableHiding: false
          }
        ] satisfies ColumnDef<Organization>[])
      : [])
  ];
}
