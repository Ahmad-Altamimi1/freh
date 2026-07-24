import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions, getUserRoles } from './roles';

export const SIGN_IN_PATH = '/auth/sign-in';

/**
 * The signed-in user for the current request, or null.
 *
 * Wrapped in React `cache` so several Server Components in one render share a
 * single verification round-trip.
 *
 * Always uses `getUser()` rather than `getSession()`: the former re-validates
 * the JWT with Supabase Auth, the latter only decodes a cookie the client could
 * have tampered with. Never trust `getSession()` for an authorization decision.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user, or a redirect to sign-in.
 *
 * Use this at the top of any protected Server Component, Server Action or Route
 * Handler. The proxy already blocks unauthenticated requests to /dashboard, but
 * that is a UX redirect — this is the check that actually guards data access,
 * and it must not be skipped just because the proxy exists.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}

/**
 * Convenience view of a Supabase user, safe to pass into Client Components.
 *
 * Carries only what the UI needs — never spread a raw Supabase `User` across
 * the server/client boundary, as it contains the full identity payload.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  permissions: string[];
};

/**
 * Projects a Supabase user into the shape the UI renders.
 *
 * Supabase puts profile fields in `user_metadata`, which is user-writable — it
 * is fine for display, but never branch on it for authorization. Use
 * `app_metadata` (see `@/lib/auth/roles`) for that.
 */
export function toSessionUser(user: User): SessionUser {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    user.email?.split('@')[0] ||
    'User';

  return {
    id: user.id,
    email: user.email ?? '',
    name,
    avatarUrl: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
    roles: getUserRoles(user),
    permissions: getUserPermissions(user)
  };
}
