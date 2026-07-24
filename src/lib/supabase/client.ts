import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

/**
 * Supabase client for use in Client Components.
 *
 * Reads the session from cookies written by the server client, so the browser
 * and server always agree on who is signed in. Safe to call repeatedly —
 * @supabase/ssr returns the same underlying instance per browser context.
 */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
