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
import { deleteCorrespondenceMutation } from '../../api/mutations';
import type { Correspondence } from '../../api/types';
import { CORRESPONDENCE_LABELS } from '../../constants/labels';

interface CellActionProps {
  data: Correspondence;
}

export function CellAction({ data }: CellActionProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteMutation = useMutation({
    ...deleteCorrespondenceMutation,
    onSuccess: () => {
      toast.success(CORRESPONDENCE_LABELS.delete.success);
      setDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || CORRESPONDENCE_LABELS.delete.failed)
  });

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(data.id)}
        loading={deleteMutation.isPending}
        title={CORRESPONDENCE_LABELS.delete.title}
        description={`«${data.name}» — ${CORRESPONDENCE_LABELS.delete.description}`}
        confirmLabel={CORRESPONDENCE_LABELS.delete.confirm}
        cancelLabel={CORRESPONDENCE_LABELS.delete.cancel}
      />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<Button variant='ghost' className='size-8 p-0' />}>
          <span className='sr-only'>{CORRESPONDENCE_LABELS.actions.openMenu}</span>
          <Icons.ellipsis className='size-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{CORRESPONDENCE_LABELS.actions.rowActions}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/dashboard/correspondences/${data.id}`)}>
              <Icons.search className='size-4' />
              {CORRESPONDENCE_LABELS.actions.view}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/correspondences/${data.id}/edit`)}
            >
              <Icons.edit className='size-4' />
              {CORRESPONDENCE_LABELS.actions.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant='destructive' onClick={() => setDeleteOpen(true)}>
              <Icons.trash className='size-4' />
              {CORRESPONDENCE_LABELS.actions.delete}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
