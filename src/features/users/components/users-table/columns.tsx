'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { RoleOption, User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { formatDateAr } from '@/lib/format';
import { USER_FIELD_LABELS, USER_STATUS_LABELS, USER_TABLE_LABELS } from '../../constants/labels';
import { CellAction } from './cell-action';

/**
 * Column definitions, built around the roles that currently exist.
 *
 * A function rather than a constant because the role filter's options are rows
 * in the `roles` table — a role added from the access-control screens has to
 * show up here without a deploy.
 */
export function getUserColumns(roleOptions: RoleOption[]): ColumnDef<User>[] {
  return [
    {
      id: 'name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title={USER_FIELD_LABELS.name} />
      ),
      cell: ({ row }) => (
        <span className='font-medium'>
          {row.original.first_name} {row.original.last_name}
        </span>
      ),
      meta: {
        label: USER_FIELD_LABELS.name,
        placeholder: USER_TABLE_LABELS.searchPlaceholder,
        variant: 'text' as const,
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title={USER_FIELD_LABELS.email} />
      ),
      cell: ({ cell }) => {
        const email = cell.getValue<User['email']>();
        if (!email) return <span className='text-muted-foreground'>{USER_TABLE_LABELS.empty}</span>;
        // An LTR island — without dir the bidi algorithm reorders it against
        // the RTL paragraph direction.
        return (
          <span dir='ltr' className='text-start'>
            {email}
          </span>
        );
      }
    },
    {
      accessorKey: 'phone',
      header: USER_FIELD_LABELS.phone,
      cell: ({ cell }) => {
        const phone = cell.getValue<User['phone']>();
        if (!phone) return <span className='text-muted-foreground'>{USER_TABLE_LABELS.empty}</span>;
        return (
          <span dir='ltr' className='text-start'>
            {phone}
          </span>
        );
      }
    },
    {
      id: 'role',
      accessorFn: (row) => row.roles.map((role) => role.key),
      enableSorting: false,
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title={USER_FIELD_LABELS.role} />
      ),
      cell: ({ row }) => {
        const roles = row.original.roles;
        if (roles.length === 0) {
          return <span className='text-muted-foreground'>{USER_TABLE_LABELS.noRole}</span>;
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {roles.map((role) => (
              <Badge key={role.key} variant='outline'>
                {role.name}
              </Badge>
            ))}
          </div>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: USER_FIELD_LABELS.role,
        variant: 'multiSelect' as const,
        options: roleOptions
      }
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: USER_FIELD_LABELS.status,
      cell: ({ cell }) => {
        const status = cell.getValue<User['status']>();
        const variant =
          status === 'Active' ? 'default' : status === 'Inactive' ? 'secondary' : 'outline';
        return <Badge variant={variant}>{USER_STATUS_LABELS[status] ?? status}</Badge>;
      }
    },
    {
      id: 'last_sign_in_at',
      accessorKey: 'last_sign_in_at',
      header: ({ column }: { column: Column<User, unknown> }) => (
        <DataTableColumnHeader column={column} title={USER_FIELD_LABELS.lastSignInAt} />
      ),
      cell: ({ cell }) => {
        const value = cell.getValue<User['last_sign_in_at']>();
        if (!value) {
          return <span className='text-muted-foreground'>{USER_TABLE_LABELS.neverSignedIn}</span>;
        }
        return <span className='text-muted-foreground text-sm'>{formatDateAr(value)}</span>;
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => <CellAction data={row.original} />
    }
  ];
}
