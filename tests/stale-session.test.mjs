// Unit tests for stale Supabase session handling (src/lib/auth/stale-session.ts).
// Fake Supabase clients and cookie jars; no network. Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EXPIRED_COOKIE,
  NO_STORE,
  STALE_SESSION_CODES,
  authCookieNames,
  isStaleSessionConsoleCall,
  projectRef,
  quietStaleSessionWarnings,
  readClaims,
  staleSessionCode,
  withoutAuthCookies,
} from '../src/lib/auth/stale-session.ts';

const REF = 'abcdref';
const BASE = `sb-${REF}-auth-token`;
const COOKIES = [BASE, `${BASE}.0`, `${BASE}.1`, `${BASE}-code-verifier`, 'sb-otherref-auth-token', 'motohub-theme'];

/** Shape of @supabase/auth-js AuthApiError (name, code, status, __isAuthError). */
function authApiError(code, status = 400) {
  const e = new Error(`fake ${code}`);
  e.name = 'AuthApiError';
  e.code = code;
  e.status = status;
  e.__isAuthError = true;
  return e;
}

const throwing = (error) => ({ auth: { getClaims: async () => { throw error; } } });
const returning = (result) => ({ auth: { getClaims: async () => result } });

function collectLogs() {
  const lines = [];
  return { lines, log: (line) => lines.push(line) };
}

describe('staleSessionCode', () => {
  test('recognises each stale-session code on an AuthApiError', () => {
    for (const code of STALE_SESSION_CODES) assert.equal(staleSessionCode(authApiError(code)), code);
    assert.deepEqual([...STALE_SESSION_CODES], ['refresh_token_not_found', 'session_not_found', 'invalid_grant']);
  });

  test('ignores other codes, plain errors and non-errors', () => {
    assert.equal(staleSessionCode(authApiError('over_request_rate_limit', 429)), null);
    assert.equal(staleSessionCode(authApiError('validation_failed')), null);
    assert.equal(staleSessionCode(Object.assign(new Error('x'), { code: 'refresh_token_not_found' })), null);
    assert.equal(staleSessionCode(new TypeError('fetch failed')), null);
    for (const v of [null, undefined, 'refresh_token_not_found', 42]) assert.equal(staleSessionCode(v), null);
  });
});

describe('authCookieNames / projectRef', () => {
  test('selects the base auth cookie and its numbered chunks only', () => {
    assert.deepEqual(authCookieNames(COOKIES, REF), [BASE, `${BASE}.0`, `${BASE}.1`]);
    assert.deepEqual(authCookieNames([`${BASE}.x`, `${BASE}.`, `${BASE}.1a`, 'motohub-theme'], REF), []);
  });

  test('reads the project ref from the Supabase URL', () => {
    assert.equal(projectRef('https://abcdref.supabase.co'), 'abcdref');
    assert.equal(projectRef('https://abcdref.supabase.co/'), 'abcdref');
  });
});

describe('readClaims', () => {
  for (const code of STALE_SESSION_CODES) {
    test(`thrown ${code}: signed out, auth cookies listed for clearing, one short log line`, async () => {
      const { lines, log } = collectLogs();
      const result = await readClaims(throwing(authApiError(code)), COOKIES, REF, log);
      assert.equal(result.claims, null);
      assert.deepEqual(result.stale, { code, cleared: [BASE, `${BASE}.0`, `${BASE}.1`] });
      assert.equal(lines.length, 1);
      assert.match(lines[0], new RegExp(`^\\[auth\\] stale session \\(${code}\\)`));
      assert.ok(lines[0].length < 100);
    });

    test(`returned ${code} (getClaims result error): same outcome`, async () => {
      const { lines, log } = collectLogs();
      const result = await readClaims(returning({ data: null, error: authApiError(code) }), COOKIES, REF, log);
      assert.equal(result.claims, null);
      assert.equal(result.stale.code, code);
      assert.equal(result.stale.cleared.length, 3);
      assert.equal(lines.length, 1);
    });
  }

  test('the log line never contains cookie values or tokens', async () => {
    const { lines, log } = collectLogs();
    await readClaims(throwing(authApiError('refresh_token_not_found')), COOKIES, REF, log);
    assert.doesNotMatch(lines[0], /eyJ|base64-|token=/);
  });

  test('other thrown errors are rethrown, nothing cleared or logged', async () => {
    for (const error of [new TypeError('fetch failed'), authApiError('over_request_rate_limit', 429), new Error('boom')]) {
      const { lines, log } = collectLogs();
      await assert.rejects(readClaims(throwing(error), COOKIES, REF, log), (e) => e === error);
      assert.equal(lines.length, 0);
    }
  });

  test('a signed-in user is returned unchanged', async () => {
    const claims = { sub: 'user-1', email: 'a@b.mu' };
    const { lines, log } = collectLogs();
    const result = await readClaims(returning({ data: { claims }, error: null }), COOKIES, REF, log);
    assert.deepEqual(result, { claims, stale: null });
    assert.equal(lines.length, 0);
  });

  test('a guest (no session) and other returned errors stay signed out without clearing', async () => {
    for (const r of [{ data: null, error: null }, { data: null, error: authApiError('validation_failed') },
      { data: { claims: { sub: 'x' } }, error: authApiError('over_request_rate_limit', 429) }]) {
      const result = await readClaims(returning(r), COOKIES, REF, () => assert.fail('no log'));
      assert.deepEqual(result, { claims: null, stale: null });
    }
  });
});

describe('quietStaleSessionWarnings', () => {
  function fakeConsole() {
    const seen = [];
    return { seen, warn: (...a) => seen.push(['warn', ...a]), error: (...a) => seen.push(['error', ...a]) };
  }

  test('drops only the raw stale-session AuthApiError dumps', () => {
    const c = fakeConsole();
    quietStaleSessionWarnings(c);
    for (const code of STALE_SESSION_CODES) {
      c.warn(authApiError(code));
      c.error(authApiError(code));
    }
    assert.equal(c.seen.length, 0);
  });

  test('every other call passes through unchanged', () => {
    const c = fakeConsole();
    quietStaleSessionWarnings(c);
    const other = authApiError('over_request_rate_limit', 429);
    const boom = new Error('boom');
    c.warn(other);
    c.error(boom);
    c.warn('note', authApiError('refresh_token_not_found'));   // extra arguments: not the auth-js dump
    c.error('[account] customer lookup failed: 42501');
    assert.deepEqual(c.seen.map((s) => s.slice(1)), [[other], [boom], ['note', c.seen[2][2]], ['[account] customer lookup failed: 42501']]);
  });

  test('installs once', () => {
    const c = fakeConsole();
    quietStaleSessionWarnings(c);
    const wrapped = c.warn;
    quietStaleSessionWarnings(c);
    assert.equal(c.warn, wrapped);
    assert.equal(isStaleSessionConsoleCall([authApiError('session_not_found')]), true);
    assert.equal(isStaleSessionConsoleCall([new Error('x')]), false);
  });
});

/* Fakes mirroring NextRequest.cookies / NextResponse (cookies + headers). */
function fakeRequestCookies(names) {
  const jar = new Map(names.map((n) => [n, 'value']));
  return { jar, delete: (n) => jar.delete(n) };
}
function fakeResponse(snapshot = null) {
  const cookies = new Map();
  const headers = new Map();
  return {
    snapshot,
    cookies: {
      getAll: () => [...cookies.entries()].map(([name, c]) => ({ name, ...c })),
      set: (name, value, options = {}) => cookies.set(name, { value, ...options }),
      get: (name) => cookies.get(name),
    },
    headers: {
      get: (h) => headers.get(h) ?? null,
      set: (h, v) => headers.set(h, v),
      has: (h) => headers.has(h),
    },
  };
}

describe('withoutAuthCookies (proxy)', () => {
  test('removes the cookies from the request before building the response, then expires them', () => {
    const req = fakeRequestCookies(COOKIES);
    const original = fakeResponse();
    original.cookies.set(BASE, '', { path: '/', maxAge: 0 });           // what @supabase/ssr already set
    original.cookies.set('motohub-theme', 'dark', { path: '/' });
    original.headers.set('cache-control', 'private, no-store');
    const names = authCookieNames(COOKIES, REF);

    const next = withoutAuthCookies(req, original, names, () => fakeResponse([...req.jar.keys()]));

    assert.notEqual(next, original);
    // the request seen by Server Components no longer carries any auth cookie chunk
    assert.deepEqual(next.snapshot, [`${BASE}-code-verifier`, 'sb-otherref-auth-token', 'motohub-theme']);
    for (const n of names) assert.deepEqual(next.cookies.get(n), { value: '', ...EXPIRED_COOKIE });
    assert.deepEqual(next.cookies.get('motohub-theme'), { value: 'dark', path: '/' });
    assert.equal(next.cookies.get(`${BASE}-code-verifier`), undefined);
    assert.equal(next.headers.get('cache-control'), 'private, no-store');
  });

  test('marks the response as not cacheable when no cache header was set', () => {
    const next = withoutAuthCookies(fakeRequestCookies([BASE]), fakeResponse(), [BASE], () => fakeResponse());
    assert.equal(next.headers.get('cache-control'), NO_STORE);
    assert.equal(EXPIRED_COOKIE.maxAge, 0);
    assert.equal(EXPIRED_COOKIE.path, '/');
  });

  test('no auth cookies: the response is returned untouched', () => {
    const original = fakeResponse();
    const next = withoutAuthCookies(fakeRequestCookies(['motohub-theme']), original, [], () => assert.fail('not rebuilt'));
    assert.equal(next, original);
  });
});
