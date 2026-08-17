'use client';

import * as React from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { FilePreview } from '@/components/ui/file-preview';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';

import { createCorrespondenceMutation, invalidateCorrespondences } from '../api/mutations';
import { correspondenceOrganizationOptionsQueryOptions } from '../api/queries';
import {
  CORRESPONDENCE_FIELD_LABELS,
  CORRESPONDENCE_LABELS,
  CORRESPONDENCE_TYPE_OPTIONS
} from '../constants/labels';
import { CORRESPONDENCE_MAX_FILES, CORRESPONDENCE_MAX_FILE_SIZE_BYTES } from '../constants/upload';
import { correspondenceFormSchema, type CorrespondenceFormValues } from '../schemas/correspondence';

export function CorrespondenceCreateButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button className='text-xs md:text-sm' onClick={() => setOpen(true)}>
        <Icons.add className='size-4' />
        {CORRESPONDENCE_LABELS.actions.create}
      </Button>
      {open && <CorrespondenceCreateDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function CorrespondenceCreateDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: organizationsResponse } = useSuspenseQuery(
    correspondenceOrganizationOptionsQueryOptions()
  );
  const organizationOptions = React.useMemo(
    () => organizationsResponse.data.map((org) => ({ value: org.id, label: org.name })),
    [organizationsResponse.data]
  );

  const mutation = useMutation({
    ...createCorrespondenceMutation,
    onSuccess: () => {
      invalidateCorrespondences();
      toast.success(CORRESPONDENCE_LABELS.form.created);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || CORRESPONDENCE_LABELS.form.createFailed)
  });

  const form = useAppForm({
    defaultValues: {
      name: '',
      type: '',
      organizationId: '',
      files: []
    } as unknown as CorrespondenceFormValues,
    validators: { onSubmit: correspondenceFormSchema },
    onSubmit: async ({ value }) => {
      const formData = new FormData();
      formData.append('name', value.name);
      formData.append('type', value.type);
      formData.append('organizationId', value.organizationId);
      for (const file of value.files ?? []) formData.append('files', file);
      await mutation.mutateAsync(formData);
    }
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { FormTextField, FormSelectField, FormFileUploadField } =
    useFormFields<CorrespondenceFormValues>();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{CORRESPONDENCE_LABELS.page.createTitle}</DialogTitle>
          <DialogDescription>{CORRESPONDENCE_LABELS.page.createDescription}</DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form.Form id='correspondence-create-dialog' className='space-y-4'>
            <FormTextField
              name='name'
              label={CORRESPONDENCE_FIELD_LABELS.name}
              required
              validators={{ onBlur: correspondenceFormSchema.shape.name }}
            />

            <FormSelectField
              name='type'
              label={CORRESPONDENCE_FIELD_LABELS.type}
              required
              options={CORRESPONDENCE_TYPE_OPTIONS}
              placeholder={CORRESPONDENCE_LABELS.form.selectType}
              validators={{ onBlur: correspondenceFormSchema.shape.type }}
            />

            <form.AppField
              name='organizationId'
              validators={{ onBlur: correspondenceFormSchema.shape.organizationId }}
            >
              {(field) => (
                <field.FieldSet>
                  <field.Field>
                    <field.FieldLabel>
                      {CORRESPONDENCE_FIELD_LABELS.organizationId} *
                    </field.FieldLabel>
                    <Combobox
                      options={organizationOptions}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      placeholder={CORRESPONDENCE_LABELS.form.selectOrganization}
                      searchPlaceholder={CORRESPONDENCE_LABELS.form.searchOrganization}
                      emptyText={CORRESPONDENCE_LABELS.form.noOrganizationFound}
                    />
                  </field.Field>
                  <field.FieldError />
                </field.FieldSet>
              )}
            </form.AppField>

            <FormFileUploadField
              name='files'
              label={CORRESPONDENCE_LABELS.form.filesLabel}
              maxSize={CORRESPONDENCE_MAX_FILE_SIZE_BYTES}
              maxFiles={CORRESPONDENCE_MAX_FILES}
            />
          </form.Form>
        </form.AppForm>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {CORRESPONDENCE_LABELS.form.cancel}
          </Button>
          <Button type='submit' form='correspondence-create-dialog' isLoading={mutation.isPending}>
            <Icons.add className='size-4' />
            {CORRESPONDENCE_LABELS.form.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
