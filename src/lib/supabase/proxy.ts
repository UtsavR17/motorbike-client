import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './env';

/**
 * Refreshes the Supabase session cookie on each request (Supabase Next.js pattern).
 * This is not an authorisation layer: pages and the database (RLS) enforce access.
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
  await supabase.auth.getClaims();

  // Return this response object as is, so refreshed cookies reach the browser.
  return response;
}
