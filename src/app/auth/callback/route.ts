import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/auth/config';
import { safeNext } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

/** OAuth (PKCE) return point: swaps the one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, SITE_URL));
  }
  return NextResponse.redirect(new URL('/login?error=oauth', SITE_URL));
}
