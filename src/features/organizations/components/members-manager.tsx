'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { AlertModal } from '@/components/modal/alert-modal';
import { invalidateOrganizations, updateOrganizationMembersMutation } from '../api/mutations';
import { organizationKeys } from '../api/queries';
import type { Member } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';
import { cn } from '@/lib/utils';

interface MembersManagerProps {
  organizationId: string;
  members: Member[];
}

export function MembersManager({ organizationId, members: initialMembers }: MembersManagerProps) {
  const queryClient = useQueryClient();
  const canManage = usePermissions().can(PERMISSIONS.MEMBERS_UPDATE);
  const [members, setMembers] = React.useState<Member[]>(initialMembers);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [editMember, setEditMember] = React.useState<Member | null>(null);
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newMember, setNewMember] = React.useState<Member>({
    name: '',
    nationalId: '',
    mobile: '',
    jobTitle: ''
  });

  React.useEffect(() => {
    setMembers(initialMembers);
    setSelected(new Set());
  }, [initialMembers]);

  const saveMutation = useMutation({
    ...updateOrganizationMembersMutation,
    onSuccess: () => {
      invalidateOrganizations();
      toast.success(ORGANIZATION_LABELS.form.updated);
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organizationId) });
    },
    onError: (error) => toast.error(error.message || ORGANIZATION_LABELS.form.updateFailed)
  });

  const allSelected = members.length > 0 && selected.size === members.length;

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (prev.size === members.length && members.length > 0) {
        return new Set();
      }
      return new Set(members.map((_, i) => i));
    });
  }, [members]);

  const toggleOne = React.useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const openEdit = React.useCallback(
    (index: number) => {
      setEditIndex(index);
      setEditMember({ ...members[index] });
    },
    [members]
  );

  const closeEdit = React.useCallback(() => {
    setEditIndex(null);
    setEditMember(null);
  }, []);

  const saveEdit = React.useCallback(() => {
    if (editIndex === null || !editMember) return;
    const next = members.map((m, i) => (i === editIndex ? editMember : m));
    setMembers(next);
    saveMutation.mutate({ id: organizationId, members: next });
    closeEdit();
  }, [editIndex, editMember, members, saveMutation, organizationId, closeEdit]);

  const confirmDelete = React.useCallback(() => {
    if (deleteIndex === null) return;
    const next = members.filter((_, i) => i !== deleteIndex);
    setMembers(next);
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(deleteIndex);
      return s;
    });
    saveMutation.mutate({ id: organizationId, members: next });
    setDeleteIndex(null);
  }, [deleteIndex, members, saveMutation, organizationId]);

  const deleteSelected = React.useCallback(() => {
    const next = members.filter((_, i) => !selected.has(i));
    setMembers(next);
    setSelected(new Set());
    saveMutation.mutate({ id: organizationId, members: next });
  }, [members, selected, saveMutation, organizationId]);

  const openAdd = React.useCallback(() => {
    setNewMember({ name: '', nationalId: '', mobile: '', jobTitle: '' });
    setAddOpen(true);
  }, []);

  const confirmAdd = React.useCallback(() => {
    if (!newMember.name.trim()) {
      toast.error(ORGANIZATION_LABELS.form.memberNameRequired);
      return;
    }
    const next = [...members, { ...newMember }];
    setMembers(next);
    saveMutation.mutate({ id: organizationId, members: next });
    setAddOpen(false);
  }, [newMember, members, saveMutation, organizationId]);

  const tableSection = members.length > 0 && (
    <div className='space-y-3'>
      {canManage && (
        <div className='flex items-center gap-2'>
          <Button onClick={openAdd} variant='outline' size='sm'>
            <Icons.add className='size-4' />
            {ORGANIZATION_LABELS.form.addMember}
          </Button>
          {selected.size > 0 && (
            <Button
              variant='destructive'
              size='sm'
              onClick={deleteSelected}
              isLoading={saveMutation.isPending}
              className='rounded-lg'
            >
              <Icons.trash className='size-3.5' />
              {ORGANIZATION_LABELS.form.deleteSelected} ({selected.size})
            </Button>
          )}
        </div>
      )}

      <div className='overflow-hidden rounded-xl border border-border'>
        <table className='w-full text-right text-sm'>
          <thead>
            <tr className='border-b border-border bg-muted/50'>
              {canManage && (
                <th className='w-12 px-4 py-3'>
                  <button
                    type='button'
                    role='checkbox'
                    aria-checked={allSelected}
                    aria-label={ORGANIZATION_LABELS.form.selectAll}
                    onClick={toggleAll}
                    className={cn(
                      'flex size-5 items-center justify-center rounded-[4px] border-2 transition-all',
                      allSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-foreground/50'
                    )}
                  >
                    {allSelected && <Icons.check className='size-3.5' />}
                  </button>
                </th>
              )}
              <th className='px-4 py-3 font-medium text-muted-foreground'>#</th>
              <th className='px-4 py-3 font-medium text-muted-foreground'>
                {ORGANIZATION_LABELS.form.memberName}
              </th>
              <th className='px-4 py-3 font-medium text-muted-foreground'>
                {ORGANIZATION_LABELS.members.nationalId}
              </th>
              <th className='px-4 py-3 font-medium text-muted-foreground'>
                {ORGANIZATION_LABELS.members.mobile}
              </th>
              <th className='px-4 py-3 font-medium text-muted-foreground'>
                {ORGANIZATION_LABELS.members.jobTitle}
              </th>
              {canManage && (
                <th className='w-24 px-4 py-3 font-medium text-muted-foreground'>
                  {ORGANIZATION_LABELS.actions.rowActions}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member, i) => (
              <tr
                key={i}
                className='border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40'
              >
                {canManage && (
                  <td className='px-4 py-3'>
                    <button
                      type='button'
                      role='checkbox'
                      aria-checked={selected.has(i)}
                      aria-label={`تحديد ${member.name}`}
                      onClick={() => toggleOne(i)}
                      className={cn(
                        'flex size-5 items-center justify-center rounded-[4px] border-2 transition-all',
                        selected.has(i)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-foreground/50'
                      )}
                    >
                      {selected.has(i) && <Icons.check className='size-3.5' />}
                    </button>
                  </td>
                )}
                <td className='px-4 py-3.5 text-muted-foreground'>{i + 1}</td>
                <td className='px-4 py-3.5 font-medium text-foreground'>{member.name}</td>
                <td className='px-4 py-3.5 text-muted-foreground'>
                  <span dir='ltr' className='tabular-nums'>
                    {member.nationalId || '—'}
                  </span>
                </td>
                <td className='px-4 py-3.5'>
                  {member.mobile ? (
                    <a
                      dir='ltr'
                      href={`tel:${member.mobile}`}
                      className='tabular-nums text-muted-foreground transition-colors hover:text-foreground'
                    >
                      {member.mobile}
                    </a>
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </td>
                <td className='px-4 py-3.5 text-muted-foreground'>{member.jobTitle || '—'}</td>
                {canManage && (
                  <td className='px-4 py-3.5'>
                    <div className='flex items-center gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => openEdit(i)}
                        className='size-8 text-muted-foreground hover:text-foreground'
                      >
                        <Icons.edit className='size-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setDeleteIndex(i)}
                        className='size-8 text-muted-foreground hover:text-destructive'
                      >
                        <Icons.trash className='size-3.5' />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const emptySection = members.length === 0 && (
    <div className='flex items-center justify-center rounded-xl border border-dashed border-border py-12'>
      <div className='text-center'>
        <Icons.teams className='mx-auto mb-3 size-10 text-muted-foreground/40' />
        <p className='text-sm text-muted-foreground'>{ORGANIZATION_LABELS.members.noMembers}</p>
        {canManage && (
          <Button onClick={openAdd} variant='outline' size='sm' className='mt-4'>
            <Icons.add className='size-4' />
            {ORGANIZATION_LABELS.form.addMember}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className='space-y-3'>
      {tableSection}
      {emptySection}

      <AlertModal
        isOpen={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={confirmDelete}
        loading={saveMutation.isPending}
        title={ORGANIZATION_LABELS.form.deleteMemberConfirm}
        description={ORGANIZATION_LABELS.form.deleteMemberDescription}
        confirmLabel={ORGANIZATION_LABELS.delete.confirm}
        cancelLabel={ORGANIZATION_LABELS.delete.cancel}
      />

      <Dialog open={editIndex !== null} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{ORGANIZATION_LABELS.form.memberEditTitle}</DialogTitle>
            <DialogDescription>{ORGANIZATION_LABELS.form.editDescription}</DialogDescription>
          </DialogHeader>
          {editMember && (
            <div className='space-y-4'>
              <Field>
                <FieldLabel>{ORGANIZATION_LABELS.form.memberName}</FieldLabel>
                <Input
                  value={editMember.name}
                  onChange={(e) => setEditMember({ ...editMember, name: e.target.value })}
                  placeholder='الاسم الرباعي'
                />
              </Field>
              <Field>
                <FieldLabel>{ORGANIZATION_LABELS.form.memberNationalId}</FieldLabel>
                <Input
                  dir='ltr'
                  value={editMember.nationalId}
                  onChange={(e) => setEditMember({ ...editMember, nationalId: e.target.value })}
                  placeholder='420000000'
                />
              </Field>
              <Field>
                <FieldLabel>{ORGANIZATION_LABELS.form.memberMobile}</FieldLabel>
                <Input
                  dir='ltr'
                  inputMode='numeric'
                  value={editMember.mobile}
                  onChange={(e) => setEditMember({ ...editMember, mobile: e.target.value })}
                  placeholder='0790000000'
                />
              </Field>
              <Field>
                <FieldLabel>{ORGANIZATION_LABELS.form.memberJobTitle}</FieldLabel>
                <Input
                  value={editMember.jobTitle}
                  onChange={(e) => setEditMember({ ...editMember, jobTitle: e.target.value })}
                  placeholder='المسمى الوظيفي'
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={closeEdit}>
              {ORGANIZATION_LABELS.form.memberEditCancel}
            </Button>
            <Button onClick={saveEdit} isLoading={saveMutation.isPending}>
              <Icons.check className='size-4' />
              {ORGANIZATION_LABELS.form.memberEditSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{ORGANIZATION_LABELS.form.addMember}</DialogTitle>
            <DialogDescription>{ORGANIZATION_LABELS.form.createDescription}</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <Field>
              <FieldLabel>{ORGANIZATION_LABELS.form.memberName}</FieldLabel>
              <Input
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder='الاسم الرباعي'
              />
            </Field>
            <Field>
              <FieldLabel>{ORGANIZATION_LABELS.form.memberNationalId}</FieldLabel>
              <Input
                dir='ltr'
                value={newMember.nationalId}
                onChange={(e) => setNewMember({ ...newMember, nationalId: e.target.value })}
                placeholder='420000000'
              />
            </Field>
            <Field>
              <FieldLabel>{ORGANIZATION_LABELS.form.memberMobile}</FieldLabel>
              <Input
                dir='ltr'
                inputMode='numeric'
                value={newMember.mobile}
                onChange={(e) => setNewMember({ ...newMember, mobile: e.target.value })}
                placeholder='0790000000'
              />
            </Field>
            <Field>
              <FieldLabel>{ORGANIZATION_LABELS.form.memberJobTitle}</FieldLabel>
              <Input
                value={newMember.jobTitle}
                onChange={(e) => setNewMember({ ...newMember, jobTitle: e.target.value })}
                placeholder='المسمى الوظيفي'
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAddOpen(false)}>
              {ORGANIZATION_LABELS.form.memberEditCancel}
            </Button>
            <Button onClick={confirmAdd} isLoading={saveMutation.isPending}>
              <Icons.check className='size-4' />
              {ORGANIZATION_LABELS.form.addMember}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
