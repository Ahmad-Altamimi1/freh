'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auditLog } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { signInSchema } from '../schemas/auth';

const SIGN_IN_PATH = '/auth/sign-in';
const DEFAULT_AFTER_SIGN_IN = '/dashboard/overview';

export type AuthActionResult = { error: string } | undefined;

/**
 * Restricts post-login navigation to same-origin paths.
 *
 * `redirectTo` arrives from a query string, so an attacker can put anything
 * there. Rejecting anything that is not a single-slash-prefixed path closes
 * the open-redirect hole (`//evil.com` is protocol-relative and must not pass).
 */
function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

/**
 * Signs a user in with email and password.
 *
 * Returns `{ error }` for the form to render, or redirects on success.
 * The error text is deliberately generic — distinguishing "no such user" from
 * "wrong password" would let anyone enumerate which emails have accounts.
 */
export async function signInAction(formData: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: 'Please check the email and password you entered.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    await auditLog({
      action: 'LOGIN',
      entityType: 'auth.session',
      entityId: null,
      actor: { id: null, email: parsed.data.email, type: 'anonymous' },
      metadata: { outcome: 'failure', reason: error.message }
    });
    return { error: 'Invalid email or password.' };
  }

  await auditLog({
    action: 'LOGIN',
    entityType: 'auth.session',
    entityId: data.user?.id ?? null,
    actor: { id: data.user?.id ?? null, email: data.user?.email ?? null, type: 'user' },
    metadata: { outcome: 'success' }
  });

  revalidatePath('/', 'layout');
  // redirect() throws internally, so it must sit outside any try/catch.
  redirect(safeRedirectPath(formData.redirectTo, DEFAULT_AFTER_SIGN_IN));
}

/** Ends the session and returns the user to the sign-in screen. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  await auditLog({
    action: 'LOGOUT',
    entityType: 'auth.session',
    entityId: user?.id ?? null,
    actor: { id: user?.id ?? null, email: user?.email ?? null, type: 'user' },
    metadata: { outcome: 'success' }
  });

  revalidatePath('/', 'layout');
  redirect(SIGN_IN_PATH);
}
