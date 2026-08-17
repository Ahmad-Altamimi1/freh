'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createUserMutation, invalidateUsers, updateUserMutation } from '../api/mutations';
import { assignableRolesQueryOptions } from '../api/queries';
import { useSessionUser } from '@/components/layout/session-provider';
import type { User } from '../api/types';
import { toast } from 'sonner';
import * as z from 'zod';
import { createUserSchema, updateUserSchema, type UserFormValues } from '../schemas/user';
import {
  USER_FIELD_LABELS,
  USER_FORM_LABELS,
  USER_MESSAGES,
  USER_VALIDATION_MESSAGES,
  USERS_PAGE_LABELS
} from '../constants/labels';
import { STATUS_OPTIONS } from './users-table/options';

/** `FormSelectField` needs a non-empty value, so "no role" gets a sentinel. */
const NO_ROLE = '__none__';

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const isEdit = !!user;
  const sessionUser = useSessionUser();
  // The service refuses to let anyone change their own role — locking the
  // control here turns that rejection into something the user sees first.
  const isSelf = user?.id === sessionUser.id;

  // Not `useSuspenseQuery`: the "add user" trigger lives in the page header,
  // outside the table's HydrationBoundary, and would suspend with no boundary
  // above it.
  const { data: roleOptions = [] } = useQuery(assignableRolesQueryOptions());

  const roleFieldOptions = [{ value: NO_ROLE, label: USER_FORM_LABELS.noRole }, ...roleOptions];

  const createMutation = useMutation({
    ...createUserMutation,
    onSuccess: () => {
      invalidateUsers();
      toast.success(USER_MESSAGES.created);
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => toast.error(error.message || USER_MESSAGES.createFailed)
  });

  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      invalidateUsers();
      toast.success(USER_MESSAGES.updated);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || USER_MESSAGES.updateFailed)
  });

  const form = useAppForm({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.roles[0]?.key || NO_ROLE,
      // 'Invited' is a derived state, not something this form can set — an
      // invited user is simply not banned, which is exactly what 'Active'
      // writes, so the account is left as it was.
      status: user?.status === 'Inactive' ? 'Inactive' : 'Active',
      password: ''
    } as UserFormValues,
    validators: {
      onSubmit: isEdit ? updateUserSchema : createUserSchema
    },
    onSubmit: async ({ value }) => {
      const values: UserFormValues = {
        ...value,
        role: value.role === NO_ROLE ? '' : value.role
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: user.id, values });
      } else {
        await createMutation.mutateAsync(values);
      }
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<UserFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? USER_FORM_LABELS.editTitle : USER_FORM_LABELS.createTitle}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? USER_FORM_LABELS.editDescription : USER_FORM_LABELS.createDescription}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='user-form-sheet' className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormTextField
                  name='first_name'
                  label={USER_FIELD_LABELS.firstName}
                  required
                  validators={{
                    onBlur: z.string().min(2, USER_VALIDATION_MESSAGES.firstName)
                  }}
                />
                <FormTextField
                  name='last_name'
                  label={USER_FIELD_LABELS.lastName}
                  required
                  validators={{
                    onBlur: z.string().min(2, USER_VALIDATION_MESSAGES.lastName)
                  }}
                />
              </div>

              <FormTextField
                name='email'
                label={USER_FIELD_LABELS.email}
                required
                type='email'
                dir='ltr'
                placeholder='name@example.com'
                description={USER_FORM_LABELS.emailHint}
                validators={{
                  onBlur: z.string().email(USER_VALIDATION_MESSAGES.email)
                }}
              />

              <FormTextField
                name='password'
                label={isEdit ? USER_FIELD_LABELS.newPassword : USER_FIELD_LABELS.password}
                required={!isEdit}
                type='password'
                dir='ltr'
                placeholder={USER_FORM_LABELS.passwordPlaceholder}
                description={
                  isEdit ? USER_FORM_LABELS.passwordEditHint : USER_FORM_LABELS.passwordCreateHint
                }
              />

              <FormTextField
                name='phone'
                label={USER_FIELD_LABELS.phone}
                type='tel'
                dir='ltr'
                placeholder='07XXXXXXXX'
                description={USER_FORM_LABELS.phoneHint}
              />

              <FormSelectField
                name='role'
                label={USER_FIELD_LABELS.role}
                options={roleFieldOptions}
                placeholder={USER_FORM_LABELS.selectRole}
                disabled={isSelf}
                description={isSelf ? USER_FORM_LABELS.selfRoleLocked : USER_FORM_LABELS.roleHint}
              />

              {isEdit && (
                <FormSelectField
                  name='status'
                  label={USER_FIELD_LABELS.status}
                  required
                  options={STATUS_OPTIONS}
                  placeholder={USER_FORM_LABELS.selectStatus}
                  description={USER_FORM_LABELS.statusHint}
                />
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {USER_FORM_LABELS.cancel}
          </Button>
          <Button type='submit' form='user-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? USER_FORM_LABELS.submitEdit : USER_FORM_LABELS.submitCreate}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function UserFormSheetTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='me-2 h-4 w-4' /> {USERS_PAGE_LABELS.addUser}
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
