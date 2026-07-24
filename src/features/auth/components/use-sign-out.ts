'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { signOutAction } from '../actions/auth-actions';

/**
 * Signs the current user out.
 *
 * The action redirects on success, so nothing after `signOutAction()` runs in
 * the happy path — the catch only fires when the request itself failed.
 */
export function useSignOut() {
  const [isPending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      try {
        await signOutAction();
      } catch {
        toast.error('Could not sign out. Please try again.');
      }
    });
  };

  return { signOut, isPending };
}
