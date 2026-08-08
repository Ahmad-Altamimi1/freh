'use client';

import { useMutation } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, type Permission } from '@/lib/auth/permissions';
import { createRoleMutation, invalidateRoles, updateRoleMutation } from '../api/mutations';
import type { Role } from '../api/types';
import { ROLE_FIELD_LABELS, ROLE_FORM_LABELS, ROLES_PAGE_LABELS } from '../constants/labels';

type RoleFormValues = {
  key: string;
  name: string;
  description: string;
};

interface RoleFormSheetProps {
  role?: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleFormSheet({ role, open, onOpenChange }: RoleFormSheetProps) {
  const isEdit = !!role;
  const isSystem = role?.isSystem ?? false;

  /**
   * The permission matrix is local state rather than a form field.
   *
   * It is a set, not a scalar — the form library's field model would have it
   * re-validating and re-rendering the whole sheet on every checkbox, and there
   * is nothing to validate: any subset of the catalog is a legal role.
   *
   * Keyed on the sheet being open so reopening it for a different row starts
   * from that row's permissions rather than the previous row's edits.
   */
  const [permissions, setPermissions] = React.useState<Set<Permission>>(
    () => new Set(role?.permissions ?? [])
  );

  React.useEffect(() => {
    if (open) setPermissions(new Set(role?.permissions ?? []));
  }, [open, role]);

  const togglePermission = (permission: Permission, checked: boolean) => {
    setPermissions((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  };

  const createMutation = useMutation({
    ...createRoleMutation,
    // Overriding `onSuccess` replaces the options' own handler rather than
    // adding to it, so the invalidation has to be repeated here — without it
    // the new role does not appear until the page is reloaded.
    onSuccess: () => {
      invalidateRoles();
      toast.success(ROLE_FORM_LABELS.createSuccess);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || ROLE_FORM_LABELS.failed)
  });

  const updateMutation = useMutation({
    ...updateRoleMutation,
    onSuccess: () => {
      invalidateRoles();
      toast.success(ROLE_FORM_LABELS.updateSuccess);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || ROLE_FORM_LABELS.failed)
  });

  const form = useAppForm({
    defaultValues: {
      key: role?.key ?? '',
      name: role?.name ?? '',
      description: role?.description ?? ''
    } as RoleFormValues,
    onSubmit: async ({ value }) => {
      const values = {
        ...value,
        // The system role's permissions are derived server-side; sending the
        // full catalog keeps the payload honest about what it holds.
        permissions: isSystem ? [...ALL_PERMISSIONS] : [...permissions]
      };

      if (isEdit) await updateMutation.mutateAsync({ id: role.id, values });
      else await createMutation.mutateAsync(values);
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<RoleFormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? ROLE_FORM_LABELS.editTitle : ROLE_FORM_LABELS.createTitle}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? ROLE_FORM_LABELS.editDescription : ROLE_FORM_LABELS.createDescription}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto px-1'>
          <form.AppForm>
            <form.Form id='role-form-sheet' className='space-y-4'>
              {/* The key is the stable identity every grant points at, so it is
                  set once and shown read-only afterwards. */}
              <FormTextField
                name='key'
                label={ROLE_FIELD_LABELS.key}
                required={!isEdit}
                disabled={isEdit}
                dir='ltr'
                placeholder='data_entry'
                description={ROLE_FIELD_LABELS.keyHint}
                validators={{
                  onBlur: z
                    .string()
                    .regex(/^[a-z][a-z0-9_-]*$/, ROLE_FIELD_LABELS.keyHint)
                    .or(z.literal(''))
                }}
              />

              <FormTextField name='name' label={ROLE_FIELD_LABELS.name} required />

              <FormTextareaField name='description' label={ROLE_FIELD_LABELS.description} />
            </form.Form>
          </form.AppForm>

          <PermissionMatrix
            selected={permissions}
            onToggle={togglePermission}
            onSelectAll={() => setPermissions(new Set(ALL_PERMISSIONS))}
            onClearAll={() => setPermissions(new Set())}
            disabled={isSystem}
          />

          {isSystem && (
            <p className='text-muted-foreground mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm'>
              {ROLE_FORM_LABELS.systemRoleNotice}
            </p>
          )}
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {ROLE_FORM_LABELS.cancel}
          </Button>
          <Button type='submit' form='role-form-sheet' isLoading={isPending}>
            <Icons.check /> {ROLE_FORM_LABELS.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The permission catalog rendered as grouped checkboxes.
 *
 * Iterates `PERMISSION_GROUPS` rather than a list local to this component, so a
 * permission added to the catalog appears here automatically — there is no
 * second list to forget to update.
 */
function PermissionMatrix({
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  disabled
}: {
  selected: Set<Permission>;
  onToggle: (permission: Permission, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  disabled: boolean;
}) {
  return (
    <section className='mt-6 space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>{ROLE_FIELD_LABELS.permissions}</h3>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-xs' dir='ltr'>
            {ROLE_FORM_LABELS.permissionCount(selected.size, ALL_PERMISSIONS.length)}
          </span>
          <Button type='button' variant='ghost' size='sm' onClick={onSelectAll} disabled={disabled}>
            {ROLE_FORM_LABELS.selectAll}
          </Button>
          <Button type='button' variant='ghost' size='sm' onClick={onClearAll} disabled={disabled}>
            {ROLE_FORM_LABELS.clearAll}
          </Button>
        </div>
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div key={group.key} className='rounded-lg border border-border p-3'>
          <p className='mb-2 text-sm font-medium'>{group.label}</p>
          <div className='space-y-2'>
            {group.permissions.map((entry) => (
              <label
                key={entry.permission}
                className='flex cursor-pointer items-start gap-2 text-sm'
              >
                <Checkbox
                  className='mt-0.5'
                  checked={selected.has(entry.permission)}
                  disabled={disabled}
                  onCheckedChange={(checked) => onToggle(entry.permission, checked === true)}
                />
                <span>
                  <span className='block'>{entry.label}</span>
                  {entry.description && (
                    <span className='text-muted-foreground block text-xs'>{entry.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function RoleFormSheetTrigger() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='me-2 h-4 w-4' /> {ROLES_PAGE_LABELS.addRole}
      </Button>
      <RoleFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
