import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from '@/lib/env';

let cachedAdminClient: SupabaseClient | undefined;

/**
 * Supabase client authenticated with the service role key.
 *
 * This client BYPASSES Row Level Security. Use it only for trusted server-side
 * work where you have already established who the caller is and what they may
 * do — never expose it to a Client Component, a Route Handler that echoes
 * results straight back, or anything reachable without an auth check.
 *
 * For anything acting on behalf of the signed-in user, use `./server.ts`
 * instead so RLS still applies.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() was called in the browser. The service role key must never reach the client.'
    );
  }
  if (cachedAdminClient) return cachedAdminClient;

  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  cachedAdminClient = createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );

  return cachedAdminClient;
}
