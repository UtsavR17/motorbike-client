// Public Supabase settings. Only the publishable (anon) key is ever used by this app.
// The variables are referenced literally so Next.js can inline them for the browser.

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.',
    );
  }
  return { url, key };
}

/** Public storage prefix; the only place remote images may come from. */
export function publicStoragePrefix(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/+$/, '')}/storage/v1/object/public/`;
}
