'use client';

import { useStore } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { formatDateAr } from '@/lib/format';
import {
  createOrganizationMutation,
  invalidateOrganizations,
  updateOrganizationMutation
} from '../api/mutations';
import { organizationFacetsQueryOptions } from '../api/queries';
import type { Organization } from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';
import { calculateTermEnd } from '../lib/term';
import { organizationFormSchema, type OrganizationFormValues } from '../schemas/organization';

const LABELS = ORGANIZATION_LABELS.form;

interface OrganizationFormSheetProps {
  /** Absent for a create. */
  organization?: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create/edit form for a single organization.
 *
 * District and classification are selects fed by the facets query rather than
 * free text. Both are controlled vocabularies in this registry — eight
 * districts, six classifications — and a typo in either silently creates a new
 * facet, splitting the reports and the filter list. A value that genuinely does
 * not exist yet arrives through an import, which is where new vocabulary is
 * introduced deliberately.
 */
export function OrganizationFormSheet({
  organization,
  open,
  onOpenChange
}: OrganizationFormSheetProps) {
  const isEdit = Boolean(organization);

  const { data: facets } = useSuspenseQuery(organizationFacetsQueryOptions());

  const districtOptions = React.useMemo(
    () => facets.districts.map((facet) => ({ value: facet.value, label: facet.value })),
    [facets.districts]
  );

  const classificationOptions = React.useMemo(
    () => [
      { value: '', label: LABELS.noClassification },
      ...facets.classifications.map((facet) => ({ value: facet.value, label: facet.value }))
    ],
    [facets.classifications]
  );

  const createMutation = useMutation({
    ...createOrganizationMutation,
    onSuccess: () => {
      invalidateOrganizations();
      toast.success(LABELS.created);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || LABELS.createFailed)
  });

  const updateMutation = useMutation({
    ...updateOrganizationMutation,
    onSuccess: () => {
      invalidateOrganizations();
      toast.success(LABELS.updated);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || LABELS.updateFailed)
  });

  const form = useAppForm({
    defaultValues: {
      name: organization?.name ?? '',
      district: organization?.district ?? '',
      classification: organization?.classification ?? '',
      nationalId: organization?.nationalId ?? '',
      establishedAt: organization?.establishedAt ?? '',
      termStart: organization?.termStart ?? '',
      termLength: organization?.termLength ?? '',
      directorName: organization?.directorName ?? '',
      mobile: organization?.mobile ?? '',
      members: organization?.members ?? []
    } as OrganizationFormValues,
    validators: { onSubmit: organizationFormSchema },
    onSubmit: async ({ value }) => {
      if (organization) {
        await updateMutation.mutateAsync({ id: organization.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  /**
   * Re-seed when the sheet opens.
   *
   * The row is a prop, and the same sheet instance is reused for the next row
   * the user picks — without this it would open showing the previous one's
   * values, and an edit would be saved against the wrong organization.
   */
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: organization?.name ?? '',
      district: organization?.district ?? '',
      classification: organization?.classification ?? '',
      nationalId: organization?.nationalId ?? '',
      establishedAt: organization?.establishedAt ?? '',
      termStart: organization?.termStart ?? '',
      termLength: organization?.termLength ?? '',
      directorName: organization?.directorName ?? '',
      mobile: organization?.mobile ?? '',
      members: organization?.members ?? []
    } as OrganizationFormValues);
    // `form` is stable; re-running on it would reset mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organization]);

  const { FormTextField, FormSelectField } = useFormFields<OrganizationFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Never a form field — always derived, so it can't drift from what the
  // server will actually save. Recomputed with the same pure function the
  // write layer uses.
  const termEnd = useStore(form.store, (state) =>
    calculateTermEnd(state.values.termStart, state.values.termLength)
  );

  const members = useStore(form.store, (state) => state.values.members);

  const addMember = React.useCallback(() => {
    const next = [...members, { name: '', nationalId: '', mobile: '', jobTitle: '' }];
    form.setFieldValue('members', next);
  }, [form, members]);

  const removeMember = React.useCallback(
    (index: number) => {
      const next = members.filter((_, i) => i !== index);
      form.setFieldValue('members', next);
    },
    [form, members]
  );

  const updateMember = React.useCallback(
    (index: number, field: string, value: string) => {
      const next = members.map((m, i) => (i === index ? { ...m, [field]: value } : m));
      form.setFieldValue('members', next);
    },
    [form, members]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? LABELS.editTitle : LABELS.createTitle}</SheetTitle>
          <SheetDescription>
            {isEdit ? LABELS.editDescription : LABELS.createDescription}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto px-4'>
          <form.AppForm>
            <form.Form id='organization-form-sheet' className='space-y-4'>
              <FormTextField
                name='name'
                label={ORGANIZATION_FIELD_LABELS.name}
                required
                placeholder='جمعية …'
              />

              <FormSelectField
                name='district'
                label={ORGANIZATION_FIELD_LABELS.district}
                required
                options={districtOptions}
                placeholder={LABELS.selectDistrict}
              />

              <FormSelectField
                name='classification'
                label={ORGANIZATION_FIELD_LABELS.classification}
                options={classificationOptions}
                placeholder={LABELS.selectClassification}
              />

              {/* Identifiers and dates are left-to-right sequences even on an
                  RTL page; without `dir` the bidi algorithm reorders them. */}
              <FormTextField
                name='nationalId'
                label={ORGANIZATION_FIELD_LABELS.nationalId}
                dir='ltr'
                inputMode='numeric'
                placeholder='420000000'
                description={LABELS.nationalIdHint}
              />

              <FormTextField
                name='establishedAt'
                label={ORGANIZATION_FIELD_LABELS.establishedAt}
                type='date'
                dir='ltr'
              />

              <FormTextField
                name='termStart'
                label={ORGANIZATION_FIELD_LABELS.termStart}
                type='date'
                dir='ltr'
              />

              <FormTextField
                name='termLength'
                label={ORGANIZATION_FIELD_LABELS.termLength}
                type='number'
                dir='ltr'
                min={1}
              />

              {/* Not a form field — always derived from termStart + termLength,
                  never independently editable or submitted. */}
              <Field>
                <FieldLabel htmlFor='term-end-preview'>
                  {ORGANIZATION_FIELD_LABELS.termEnd}
                </FieldLabel>
                <Input
                  id='term-end-preview'
                  dir='ltr'
                  disabled
                  value={termEnd ? formatDateAr(termEnd) : ''}
                />
                <FieldDescription>{LABELS.termEndHint}</FieldDescription>
              </Field>

              <FormTextField
                name='directorName'
                label={ORGANIZATION_FIELD_LABELS.directorName}
                placeholder='الاسم الرباعي'
              />

              <FormTextField
                name='mobile'
                label={ORGANIZATION_FIELD_LABELS.mobile}
                dir='ltr'
                inputMode='numeric'
                placeholder='0790000000'
                description={LABELS.mobileHint}
              />

              <FieldSeparator>{LABELS.memberSectionTitle}</FieldSeparator>

              <div className='space-y-4'>
                {members.map((member, i) => (
                  <div key={i} className='rounded-lg border border-border bg-muted/50 p-4'>
                    <div className='mb-3 flex items-center justify-between'>
                      <span className='text-sm font-medium text-muted-foreground'>
                        {LABELS.memberSectionTitle} {i + 1}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => removeMember(i)}
                        className='text-destructive hover:text-destructive/80'
                      >
                        <Icons.trash className='size-3.5' />
                        {LABELS.removeMember}
                      </Button>
                    </div>
                    <div className='space-y-3'>
                      <Field>
                        <FieldLabel htmlFor={`member-name-${i}`}>{LABELS.memberName}</FieldLabel>
                        <Input
                          id={`member-name-${i}`}
                          value={member.name}
                          onChange={(e) => updateMember(i, 'name', e.target.value)}
                          placeholder='الاسم الرباعي'
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`member-national-id-${i}`}>
                          {LABELS.memberNationalId}
                        </FieldLabel>
                        <Input
                          id={`member-national-id-${i}`}
                          dir='ltr'
                          value={member.nationalId}
                          onChange={(e) => updateMember(i, 'nationalId', e.target.value)}
                          placeholder='420000000'
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`member-mobile-${i}`}>
                          {LABELS.memberMobile}
                        </FieldLabel>
                        <Input
                          id={`member-mobile-${i}`}
                          dir='ltr'
                          inputMode='numeric'
                          value={member.mobile}
                          onChange={(e) => updateMember(i, 'mobile', e.target.value)}
                          placeholder='0790000000'
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`member-job-title-${i}`}>
                          {LABELS.memberJobTitle}
                        </FieldLabel>
                        <Input
                          id={`member-job-title-${i}`}
                          value={member.jobTitle}
                          onChange={(e) => updateMember(i, 'jobTitle', e.target.value)}
                          placeholder='المسمى الوظيفي'
                        />
                      </Field>
                    </div>
                  </div>
                ))}

                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={addMember}
                  className='w-full'
                >
                  <Icons.add className='size-4' />
                  {LABELS.addMember}
                </Button>
              </div>
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {LABELS.cancel}
          </Button>
          <Button type='submit' form='organization-form-sheet' isLoading={isPending}>
            <Icons.check />
            {isEdit ? LABELS.save : LABELS.create}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
