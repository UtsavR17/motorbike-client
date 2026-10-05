// Open-redirect protection for "next" parameters. Pure: no imports, unit-tested in tests/.

export const DEFAULT_AFTER_LOGIN = '/account';

/**
 * Returns `value` only when it is a same-site path: it must start with a single "/",
 * must not start with "//" (protocol-relative), and must not contain backslashes
 * (browsers treat "/\" like "//") or control characters. Anything else falls back to `fallback`.
 */
export function safeNext(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return fallback;
  if (v.length === 0 || v.length > 512) return fallback;
  if (!v.startsWith('/')) return fallback;
  if (v.startsWith('//')) return fallback;
  if (v.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback;
  // A leading "/" already rules out "javascript:" or "https:" schemes; this catches
  // anything a URL parser would still treat as another origin.
  try {
    // Final guard: resolving against a dummy origin must keep that origin.
    const resolved = new URL(v, 'http://x.invalid');
    if (resolved.origin !== 'http://x.invalid') return fallback;
  } catch {
    return fallback;
  }
  return v;
}
