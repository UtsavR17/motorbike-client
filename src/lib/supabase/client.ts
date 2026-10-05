import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/** Supabase client for Client Components (not used by the guest storefront yet). */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
