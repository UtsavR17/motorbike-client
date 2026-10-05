// Public auth settings (safe for the browser).

/** Absolute site origin used in auth redirect links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** The Google button is shown only when this is exactly "true". */
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

/** Where a new account goes after confirming its email. */
export const AFTER_VERIFY = '/account/profile/complete';

/** Seconds before "Resend code" can be used again. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Builds /verify links; the email in the URL is acceptable, nothing secret is added. */
export function verifyHref(email: string, opts: { next?: string; unconfirmed?: boolean } = {}): string {
  const p = new URLSearchParams({ email });
  if (opts.unconfirmed) p.set('unconfirmed', '1');
  if (opts.next) p.set('next', opts.next);
  return `/verify?${p.toString()}`;
}

/** Builds /login links that return the user to `next` after signing in. */
export function loginHref(next?: string): string {
  return next && next !== '/account' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
