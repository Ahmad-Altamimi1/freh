'use client';

import { useMutation } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
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
import { updateRenewalDetailsMutation } from '../api/mutations';
import type { RenewalCard } from '../api/types';
import { RENEWAL_LABELS } from '../constants/labels';

const LABELS = RENEWAL_LABELS.details;

type DetailsFormValues = {
  electionDate: string;
  delegateName: string;
  notes: string;
};

interface RenewalDetailsSheetProps {
  card: RenewalCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Records the election date, the assigned delegate, and any notes.
 *
 * No Zod validator: all three fields are optional and free-form, and the only
 * constraint that matters — that the (organization, term) pair is real — is
 * one the server has to check anyway, since this form's values arrive there as
 * a Server Action call.
 */
export function RenewalDetailsSheet({ card, open, onOpenChange }: RenewalDetailsSheetProps) {
  const mutation = useMutation({
    ...updateRenewalDetailsMutation,
    onSuccess: () => {
      toast.success(RENEWAL_LABELS.toast.saved);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || RENEWAL_LABELS.toast.saveFailed)
  });

  const seed = React.useCallback(
    (): DetailsFormValues => ({
      electionDate: card.electionDate ?? '',
      delegateName: card.delegateName ?? '',
      notes: card.notes ?? ''
    }),
    [card]
  );

  const form = useAppForm({
    defaultValues: seed(),
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        organizationId: card.organizationId,
        termEndAt: card.termEndAt,
        ...value
      });
    }
  });

  /**
   * Re-seed when the sheet opens.
   *
   * One instance serves whichever card the user picked, so without this it
   * would open holding the previous card's values — and saving would write
   * them against the new organization.
   */
  React.useEffect(() => {
    if (!open) return;
    form.reset(seed());
    // `form` is stable; re-running on it would reset mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  const { FormTextField, FormTextareaField } = useFormFields<DetailsFormValues>();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{LABELS.title}</SheetTitle>
          <SheetDescription>
            «{card.organizationName}» — {RENEWAL_LABELS.card.termEnd}{' '}
            <span dir='ltr'>{formatDateAr(card.termEndAt)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto px-4'>
          <form.AppForm>
            <form.Form id='renewal-details-form' className='space-y-4'>
              {/* A date is an LTR sequence even on an RTL page. */}
              <FormTextField
                name='electionDate'
                label={LABELS.electionDate}
                type='date'
                dir='ltr'
              />
              <FormTextField
                name='delegateName'
                label={LABELS.delegateName}
                placeholder='الاسم الرباعي'
              />
              <FormTextareaField
                name='notes'
                label={LABELS.notes}
                placeholder={LABELS.notesPlaceholder}
                rows={4}
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {LABELS.cancel}
          </Button>
          <Button type='submit' form='renewal-details-form' isLoading={mutation.isPending}>
            <Icons.check />
            {LABELS.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
