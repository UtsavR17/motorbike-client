// SINGLE PRIVILEGED ENTRY POINT. This module creates a Supabase client with the
// service-role key, which bypasses RLS. It may be imported ONLY by the Stripe webhook route
// (src/app/api/stripe/webhook/route.ts). Every other part of the app must use the
// customer's own session (lib/supabase/server.ts) so RLS applies.

import 'server-only';

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
