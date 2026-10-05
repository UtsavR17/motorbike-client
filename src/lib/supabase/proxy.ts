import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './env';

// Pages a signed-in user has no reason to see.
const GUEST_ONLY = ['/login', '/register', '/forgot-password'];

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Refreshes the Supabase session cookie on each request (Supabase Next.js pattern) and
 * applies convenience redirects. This is not the authorisation layer: every account page
 * and Server Action checks the user itself (requireUser / requireCustomer), and RLS
 * protects the data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Responses that set auth cookies must never be cached by a CDN.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims():
  // getClaims() validates the JWT and triggers the token refresh when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  let target: URL | null = null;
  if (!signedIn && matches(pathname, '/account')) {
    target = new URL('/login', request.url);
    target.searchParams.set('next', `${pathname}${search}`);
  } else if (signedIn && GUEST_ONLY.some((p) => matches(pathname, p))) {
    target = new URL('/account', request.url);
  }

  if (target) {
    // Carry refreshed cookies and cache headers over to the redirect.
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    ['cache-control', 'expires', 'pragma'].forEach((h) => {
      const v = response.headers.get(h);
      if (v) redirect.headers.set(h, v);
    });
    return redirect;
  }

  // Return this response object as is, so refreshed cookies reach the browser.
  return response;
}
