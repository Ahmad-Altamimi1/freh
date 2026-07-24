'use client';

import * as React from 'react';
import type { SessionUser } from '@/lib/auth/session';

const SessionContext = React.createContext<SessionUser | null>(null);

/**
 * Makes the signed-in user available to Client Components below it.
 *
 * Seeded on the server from `requireUser()`, so there is no loading state and
 * no client-side auth round-trip. This is display/UX state only — it reflects
 * a decision already made on the server and must never be the basis of an
 * authorization check.
 */
export function SessionProvider({
  user,
  children
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The signed-in user. Throws outside a `SessionProvider`. */
export function useSessionUser(): SessionUser {
  const user = React.useContext(SessionContext);
  if (!user) {
    throw new Error('useSessionUser() must be used inside a <SessionProvider>.');
  }
  return user;
}

/** The signed-in user, or null when rendered outside a session. */
export function useOptionalSessionUser(): SessionUser | null {
  return React.useContext(SessionContext);
}
