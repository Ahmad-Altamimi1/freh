'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteOrganizationMutation, invalidateOrganizations } from '../../api/mutations';
import type { Organization } from '../../api/types';
import { ORGANIZATION_LABELS } from '../../constants/labels';
import { OrganizationFormSheet } from '../organization-form-sheet';

interface CellActionProps {
  data: Organization;
}

export function CellAction({ data }: CellActionProps) {
  const router = useRouter();
  // Edit and delete are separately grantable, so the menu renders each item on
  // its own permission rather than on one "can write" flag. The column itself is
  // only mounted for users holding at least one of them (see the listing).
  const { can } = usePermissions();
  const canUpdate = can(PERMISSIONS.ORGANIZATIONS_UPDATE);
  const canDelete = can(PERMISSIONS.ORGANIZATIONS_DELETE);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const deleteMutation = useMutation({
    ...deleteOrganizationMutation,
    onSuccess: () => {
      invalidateOrganizations();
      toast.success(ORGANIZATION_LABELS.delete.success);
      setDeleteOpen(false);
    },
    onError: (error) => toast.error(error.message || ORGANIZATION_LABELS.delete.failed)
  });

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(data.id)}
        loading={deleteMutation.isPending}
        title={ORGANIZATION_LABELS.delete.title}
        // Naming the row being deleted is what makes the confirmation worth
        // showing — "are you sure?" alone is a reflex click.
        description={`«${data.name}» — ${ORGANIZATION_LABELS.delete.description}`}
        confirmLabel={ORGANIZATION_LABELS.delete.confirm}
        cancelLabel={ORGANIZATION_LABELS.delete.cancel}
      />

      {/* Mounted only while open so the form seeds from this row and is torn
          down afterwards, rather than holding a stale copy of every row. */}
      {editOpen && canUpdate && (
        <OrganizationFormSheet organization={data} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<Button variant='ghost' className='size-8 p-0' />}>
          <span className='sr-only'>{ORGANIZATION_LABELS.actions.openMenu}</span>
          <Icons.ellipsis className='size-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {/*
            The label and the items sit inside a group. `DropdownMenuLabel`
            renders Base UI's `Menu.GroupLabel`, which reads a context only
            `Menu.Group` (`DropdownMenuGroup`) provides — placed loose in the
            content it throws "MenuGroupContext is missing" the moment the menu
            opens. This mirrors the users-table cell action.
          */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>{ORGANIZATION_LABELS.actions.rowActions}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/dashboard/organizations/${data.id}`)}>
              <Icons.search className='size-4' />
              {ORGANIZATION_LABELS.actions.view}
            </DropdownMenuItem>
            {canUpdate && (
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Icons.edit className='size-4' />
                {ORGANIZATION_LABELS.actions.edit}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant='destructive' onClick={() => setDeleteOpen(true)}>
                <Icons.trash className='size-4' />
                {ORGANIZATION_LABELS.actions.delete}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
