import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase auth session on every matched request and reports who
 * the request belongs to.
 *
 * Server Components cannot write cookies, so this is the only place a rotated
 * refresh token can be persisted. If this stops running, sessions silently
 * expire mid-use.
 *
 * The returned `response` carries the refreshed auth cookies. Callers that want
 * to redirect instead of continuing MUST copy those cookies onto the redirect —
 * use `applyAuthCookies` below rather than building a bare NextResponse.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  // getUser() revalidates the token against Supabase Auth. Do not swap this for
  // getSession(), which trusts the cookie contents without verifying them.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return { response, user };
}

/**
 * Copies the refreshed auth cookies from `source` onto a redirect response so
 * the rotated session is not lost when the proxy bounces a request.
 */
export function applyAuthCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}
