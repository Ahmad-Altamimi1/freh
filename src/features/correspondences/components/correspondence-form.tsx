'use client';

import * as React from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { FilePreview, type UploadedFile } from '@/components/ui/file-preview';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { useBreadcrumbOverride } from '@/hooks/use-breadcrumbs';

import {
  createCorrespondenceMutation,
  invalidateCorrespondences,
  updateCorrespondenceMutation
} from '../api/mutations';
import {
  correspondenceByIdOptions,
  correspondenceOrganizationOptionsQueryOptions
} from '../api/queries';
import type { CorrespondenceFile, CorrespondenceWithFiles } from '../api/types';
import {
  CORRESPONDENCE_FIELD_LABELS,
  CORRESPONDENCE_LABELS,
  CORRESPONDENCE_TYPE_OPTIONS
} from '../constants/labels';
import { CORRESPONDENCE_MAX_FILES, CORRESPONDENCE_MAX_FILE_SIZE_BYTES } from '../constants/upload';
import { correspondenceFormSchema, type CorrespondenceFormValues } from '../schemas/correspondence';

interface CorrespondenceFormProps {
  initialData: CorrespondenceWithFiles | null;
}

/** The `[correspondenceId]/edit` route's second path segment — see `useBreadcrumbOverride`. */
const EDIT_ROUTE_ID_SEGMENT_INDEX = 2;

export function CorrespondenceForm({ initialData }: CorrespondenceFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialData);
  const { setSegmentOverride } = useBreadcrumbOverride();

  React.useEffect(() => {
    if (!initialData) return;
    setSegmentOverride(EDIT_ROUTE_ID_SEGMENT_INDEX, initialData.name);
    return () => setSegmentOverride(EDIT_ROUTE_ID_SEGMENT_INDEX, null);
  }, [initialData, setSegmentOverride]);

  // Already-uploaded files, tracked outside TanStack Form — the file field
  // only ever holds newly-picked `File[]`, never persisted `StoredFile`s.
  const [retainedFiles, setRetainedFiles] = React.useState<CorrespondenceFile[]>(
    initialData?.files ?? []
  );

  const { data: organizationsResponse } = useSuspenseQuery(
    correspondenceOrganizationOptionsQueryOptions()
  );
  const organizationOptions = React.useMemo(
    () => organizationsResponse.data.map((org) => ({ value: org.id, label: org.name })),
    [organizationsResponse.data]
  );

  const createMutation = useMutation({
    ...createCorrespondenceMutation,
    onSuccess: (result) => {
      invalidateCorrespondences();
      toast.success(CORRESPONDENCE_LABELS.form.created);
      router.push(`/dashboard/correspondences/${result.id}`);
    },
    onError: (error: Error) => toast.error(error.message || CORRESPONDENCE_LABELS.form.createFailed)
  });

  const updateMutation = useMutation({
    ...updateCorrespondenceMutation,
    onSuccess: (result) => {
      invalidateCorrespondences();
      toast.success(CORRESPONDENCE_LABELS.form.updated);
      router.push(`/dashboard/correspondences/${result.id}`);
    },
    onError: (error: Error) => toast.error(error.message || CORRESPONDENCE_LABELS.form.updateFailed)
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      type: initialData?.type ?? '',
      organizationId: initialData?.organizationId ?? '',
      files: []
    } as CorrespondenceFormValues,
    validators: { onSubmit: correspondenceFormSchema },
    onSubmit: async ({ value }) => {
      const formData = new FormData();
      formData.append('name', value.name);
      formData.append('type', value.type);
      formData.append('organizationId', value.organizationId);
      for (const file of value.files ?? []) formData.append('files', file);

      if (initialData) {
        for (const kept of retainedFiles) formData.append('retainedFilePaths', kept.path);
        await updateMutation.mutateAsync({ id: initialData.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
    }
  });

  const { FormTextField, FormSelectField, FormFileUploadField } =
    useFormFields<CorrespondenceFormValues>();

  const existingFileItems: UploadedFile[] = retainedFiles.map((file) => ({
    id: file.path,
    url: initialData?.files.find((f) => f.path === file.path)?.url ?? undefined,
    name: file.originalName ?? file.path,
    type: file.mimeType
  }));

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>
          {isEdit ? CORRESPONDENCE_LABELS.page.editTitle : CORRESPONDENCE_LABELS.page.createTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
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
            </div>

            {isEdit && existingFileItems.length > 0 && (
              <div className='space-y-2'>
                <p className='text-sm font-medium'>
                  {CORRESPONDENCE_LABELS.form.existingFilesLabel}
                </p>
                <FilePreview
                  files={existingFileItems}
                  onRemove={(id) =>
                    setRetainedFiles((prev) => prev.filter((file) => file.path !== id))
                  }
                />
              </div>
            )}

            <FormFileUploadField
              name='files'
              label={
                isEdit
                  ? CORRESPONDENCE_LABELS.form.newFilesLabel
                  : CORRESPONDENCE_LABELS.form.filesLabel
              }
              maxSize={CORRESPONDENCE_MAX_FILE_SIZE_BYTES}
              maxFiles={CORRESPONDENCE_MAX_FILES}
            />

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                {CORRESPONDENCE_LABELS.form.cancel}
              </Button>
              <form.SubmitButton>
                {isEdit ? CORRESPONDENCE_LABELS.form.save : CORRESPONDENCE_LABELS.form.create}
              </form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

/** Fetches the record for the edit route, then renders the same form used to create one. */
export function EditCorrespondenceView({ correspondenceId }: { correspondenceId: string }) {
  const { data: correspondence } = useSuspenseQuery(correspondenceByIdOptions(correspondenceId));

  if (!correspondence) {
    notFound();
  }

  return <CorrespondenceForm initialData={correspondence} />;
}
