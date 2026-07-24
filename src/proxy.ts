import { NextResponse, type NextRequest } from 'next/server';
import { applyAuthCookies, updateSession } from '@/lib/supabase/middleware';

const SIGN_IN_PATH = '/auth/sign-in';
const AFTER_SIGN_IN_PATH = '/dashboard/overview';

/** Routes that require an authenticated user. */
function isProtectedRoute(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

/**
 * Auth screens an already-signed-in user should not sit on. Deliberately does
 * not cover `/auth/callback` or `/auth/confirm`, which must run to completion
 * even once a session exists.
 */
function isAuthRoute(pathname: string) {
  return pathname === '/auth' || pathname === SIGN_IN_PATH;
}

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = SIGN_IN_PATH;
    redirectUrl.search = '';
    // Preserve where they were headed so sign-in can send them back.
    redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return applyAuthCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (isAuthRoute(pathname) && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = AFTER_SIGN_IN_PATH;
    redirectUrl.search = '';
    return applyAuthCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
