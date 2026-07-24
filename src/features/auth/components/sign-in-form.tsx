'use client';

import { useState } from 'react';
import * as z from 'zod';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { signInAction } from '../actions/auth-actions';
import { signInSchema, type SignInFormValues } from '../schemas/auth';

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { email: '', password: '' } as SignInFormValues,
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      // On success the action redirects, so control does not return here.
      const result = await signInAction({ ...value, redirectTo });
      if (result?.error) setFormError(result.error);
    }
  });

  const { FormTextField } = useFormFields<SignInFormValues>();

  return (
    <form.AppForm>
      <form.Form id='sign-in-form' className='w-full space-y-4 p-0'>
        {formError && (
          <Alert variant='destructive'>
            <Icons.warning className='size-4' />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {/*
          `dir='ltr'` on both fields: an email address and a password are
          left-to-right sequences. Inheriting the page's RTL direction moves the
          caret to the right edge and lets the bidi algorithm reorder what the
          user typed — the text is still stored correctly, but it does not read
          back the way it was entered.
        */}
        <FormTextField
          name='email'
          label='البريد الإلكتروني'
          required
          type='email'
          dir='ltr'
          autoComplete='email'
          placeholder='you@example.com'
          validators={{ onBlur: z.email('يرجى إدخال بريد إلكتروني صالح') }}
        />

        <FormTextField
          name='password'
          label='كلمة المرور'
          required
          type='password'
          dir='ltr'
          autoComplete='current-password'
          placeholder='••••••••'
          validators={{ onBlur: z.string().min(1, 'كلمة المرور مطلوبة') }}
        />

        <form.SubmitButton className='w-full'>تسجيل الدخول</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}
