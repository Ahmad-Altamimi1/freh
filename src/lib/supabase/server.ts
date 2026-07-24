import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Always create a fresh client per request — never hoist it to a module-level
 * singleton, because the cookie store it closes over is request-scoped.
 *
 * The `setAll` call is wrapped in try/catch because Server Components are not
 * allowed to write cookies. In that case the refreshed session is discarded
 * here and written by the proxy (middleware) instead, which is why
 * `updateSession` in `./middleware.ts` must run on every matched request.
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — the proxy refreshes the session.
        }
      }
    }
  });
}
