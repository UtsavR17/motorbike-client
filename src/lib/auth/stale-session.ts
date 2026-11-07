// Stale Supabase session handling. Pure (no imports) so it can be unit-tested with fakes (tests/).
//
// A browser can keep an old Supabase auth cookie after its session has ended (signed out on
// another device, refresh token rotated or revoked, project keys changed). Reading it fails with
// an AuthApiError such as refresh_token_not_found. Such a visitor is treated as signed out and
// the stale auth cookies are cleared, so the error is not raised again on every request.

/** AuthApiError codes that mean the stored session is dead, not that something is broken. */
export const STALE_SESSION_CODES = ['refresh_token_not_found', 'session_not_found', 'invalid_grant'] as const;
export type StaleSessionCode = (typeof STALE_SESSION_CODES)[number];

/** The stale-session code of an AuthApiError, or null for anything else. */
export function staleSessionCode(error: unknown): StaleSessionCode | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { name?: unknown; code?: unknown; __isAuthError?: unknown };
  const isAuthApiError = e.name === 'AuthApiError' || e.__isAuthError === true;
  if (!isAuthApiError || typeof e.code !== 'string') return null;
  return (STALE_SESSION_CODES as readonly string[]).includes(e.code) ? (e.code as StaleSessionCode) : null;
}

/** Project ref from the Supabase URL: "https://abcd.supabase.co" -> "abcd". */
export function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0];
}

/**
 * Names of this project's auth cookies among `names`: "sb-<ref>-auth-token" and its chunks
 * "sb-<ref>-auth-token.0", ".1", ... Other cookies (code verifier, other projects) are kept.
 */
export function authCookieNames(names: readonly string[], ref: string): string[] {
  const base = `sb-${ref}-auth-token`;
  return names.filter((n) => n === base || (n.startsWith(`${base}.`) && /^\d+$/.test(n.slice(base.length + 1))));
}

/** Options that expire a cookie set by @supabase/ssr (path "/", no domain). */
export const EXPIRED_COOKIE = { path: '/', maxAge: 0, sameSite: 'lax' } as const;

interface CookieOptionsLike {
  path?: string;
  maxAge?: number;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
}

/** The parts of NextResponse used here (structural, so tests can pass fakes). */
export interface ResponseLike {
  cookies: {
    getAll(): Array<{ name: string; value: string } & CookieOptionsLike>;
    set(name: string, value: string, options?: CookieOptionsLike): unknown;
  };
  headers: { get(name: string): string | null; set(name: string, value: string): void; has(name: string): boolean };
}

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma'];
export const NO_STORE = 'private, no-cache, no-store, must-revalidate, max-age=0';

/**
 * Proxy step for a stale session: removes `names` from the incoming request (so Server
 * Components see a guest), builds the next response with `makeResponse` (called after the
 * removal, because NextResponse.next({ request }) copies the request headers), copies cookies
 * and cache headers already on `response`, expires `names` in the browser and marks the
 * response as not cacheable.
 */
export function withoutAuthCookies<R extends ResponseLike>(
  requestCookies: { delete(name: string): unknown },
  response: R,
  names: readonly string[],
  makeResponse: () => R,
): R {
  if (names.length === 0) return response;
  names.forEach((name) => requestCookies.delete(name));
  const next = makeResponse();
  response.cookies.getAll().forEach(({ name, value, ...options }) => next.cookies.set(name, value, options));
  names.forEach((name) => next.cookies.set(name, '', EXPIRED_COOKIE));
  CACHE_HEADERS.forEach((h) => {
    const v = response.headers.get(h);
    if (v) next.headers.set(h, v);
  });
  if (!next.headers.has('cache-control')) next.headers.set('cache-control', NO_STORE);
  return next;
}

/**
 * True for a console call that only reports a stale session: auth-js warns with the raw
 * AuthApiError from its INITIAL_SESSION listener, which this app never receives (it gets the
 * error from getClaims() and logs its own one-line note instead).
 */
export function isStaleSessionConsoleCall(args: readonly unknown[]): boolean {
  return args.length === 1 && staleSessionCode(args[0]) !== null;
}

const QUIET_FLAG = Symbol.for('motohub.quietStaleAuthWarnings');

/**
 * Wraps console.warn / console.error once per process so the duplicate auth-js stale-session
 * dumps are dropped. Every other call passes through unchanged.
 */
export function quietStaleSessionWarnings(target: Pick<Console, 'warn' | 'error'> = console): void {
  const flagged = target as typeof target & { [QUIET_FLAG]?: true };
  if (flagged[QUIET_FLAG]) return;
  flagged[QUIET_FLAG] = true;
  for (const level of ['warn', 'error'] as const) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) => {
      if (isStaleSessionConsoleCall(args)) return;
      original(...args);
    };
  }
}

export interface ClaimsClient<C> {
  auth: { getClaims(): Promise<{ data: { claims?: C | null } | null; error: unknown }> };
}

export interface SessionResult<C> {
  claims: C | null;
  /** Set when a stale session was detected; `cleared` lists the auth cookies to expire. */
  stale: { code: StaleSessionCode; cleared: string[] } | null;
}

/**
 * getClaims() with stale sessions treated as signed out. Returns the auth cookies to expire
 * (the caller removes them, because the cookie API differs between the proxy and Server
 * Components). Other thrown errors are rethrown; other returned errors keep the existing
 * behaviour (signed out, no cookie change). Logs at most one short line, never a token.
 */
export async function readClaims<C extends { sub?: unknown }>(
  client: ClaimsClient<C>,
  cookieNames: readonly string[],
  ref: string,
  log: (line: string) => void = (line) => console.debug(line),
): Promise<SessionResult<C>> {
  let code: StaleSessionCode | null = null;
  let claims: C | null = null;
  try {
    const { data, error } = await client.auth.getClaims();
    code = staleSessionCode(error);
    claims = !error && data?.claims?.sub ? data.claims : null;
  } catch (error) {
    code = staleSessionCode(error);
    if (!code) throw error;
  }
  if (!code) return { claims, stale: null };
  const cleared = authCookieNames(cookieNames, ref);
  log(`[auth] stale session (${code}): signed out, clearing ${cleared.length} auth cookie(s)`);
  return { claims: null, stale: { code, cleared } };
}
