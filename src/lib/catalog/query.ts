// Search terms, filters and sort order for the parts and motorcycle listings (Fix Phase 6, ISS-11).
// Pure: no database client and no server-only import, so the query construction is unit-tested
// with a mock builder (tests/search.test.mjs).
//
// Search rule: the typed text is split on whitespace into at most MAX_TERMS terms of at most
// MAX_TERM_LENGTH characters. A row matches when EVERY term is contained in its search_text
// column (built by the database from name, brand, category, description, colours, ...).
// Each term is its own parameterised ILIKE filter with %, _ and \ escaped. No .or() string is
// ever built from user input, and column names and sort keys never come from the browser.

import type { BikesQuery, PartsQuery } from '@/lib/params';

export const MAX_TERMS = 5;
export const MAX_TERM_LENGTH = 30;
export const SEARCH_COLUMN = 'search_text';

/** The search terms of a query: whitespace-separated, trimmed, capped, duplicates removed. */
export function searchTerms(text: string | undefined | null): string[] {
  if (!text) return [];
  const terms: string[] = [];
  for (const raw of text.split(/\s+/u)) {
    if (terms.length >= MAX_TERMS) break;
    // Cut by code points so a character outside the BMP is never split in half.
    const term = Array.from(raw.trim()).slice(0, MAX_TERM_LENGTH).join('');
    if (term && !terms.some((t) => t.toLowerCase() === term.toLowerCase())) terms.push(term);
  }
  return terms;
}

/**
 * Safe ILIKE "contains" pattern for one term. LIKE wildcards (% and _) and the escape character
 * are escaped so they match literally. PostgREST turns every "*" into "%", so "*" becomes "_"
 * (any single character): it still matches a literal "*" and can never widen into a run.
 */
export function containsPattern(term: string): string {
  const escaped = Array.from(term)
    .slice(0, MAX_TERM_LENGTH)
    .join('')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '_');
  return `%${escaped}%`;
}

/**
 * The subset of a PostgREST filter builder these helpers use. The callers cast the real
 * supabase-js builder to it (its generic types are too deep to infer here) and back.
 */
export interface FilterChain {
  eq(column: string, value: unknown): FilterChain;
  gte(column: string, value: unknown): FilterChain;
  lte(column: string, value: unknown): FilterChain;
  ilike(column: string, pattern: string): FilterChain;
  contains(column: string, value: unknown): FilterChain;
  order(column: string, options?: { ascending?: boolean }): FilterChain;
}

/** One ILIKE on search_text per term. */
export function applySearch(req: FilterChain, text: string | undefined): FilterChain {
  let out = req;
  for (const term of searchTerms(text)) out = out.ilike(SEARCH_COLUMN, containsPattern(term));
  return out;
}

/** Filters, search and sort for the parts listing (also used on the compatibility RPC). */
export function applyPartsQuery(req: FilterChain, q: PartsQuery): FilterChain {
  let out = req;
  if (q.category) out = out.eq('category_id', q.category);
  if (q.brand) out = out.eq('brand_id', q.brand);
  if (q.inStock) out = out.eq('in_stock', true);
  // Price filter keeps products whose price range overlaps [min, max].
  if (q.min !== undefined) out = out.gte('max_price', q.min);
  if (q.max !== undefined) out = out.lte('min_price', q.max);
  out = applySearch(out, q.q);

  if (q.sort === 'price_asc') out = out.order('min_price', { ascending: true });
  if (q.sort === 'price_desc') out = out.order('max_price', { ascending: false });
  // Stable tie-breakers so pagination never repeats or skips a product.
  return out
    .order('part_name', { ascending: true })
    .order('brand', { ascending: true })
    .order('part_id', { ascending: true })
    .order('brand_id', { ascending: true });
}

/** Filters, search and sort for the motorcycle listing (one row per model). */
export function applyBikesQuery(req: FilterChain, q: BikesQuery): FilterChain {
  let out = req;
  if (q.brand) out = out.eq('brand_id', q.brand);
  // Array columns: the value comes from the facet whitelist, never raw user input.
  if (q.fuel) out = out.contains('fuel_types', [q.fuel]);
  if (q.transmission) out = out.contains('transmissions', [q.transmission]);
  if (q.min !== undefined) out = out.gte('max_price', q.min);
  if (q.max !== undefined) out = out.lte('min_price', q.max);
  out = applySearch(out, q.q);

  if (q.sort === 'price_desc') out = out.order('max_price', { ascending: false });
  else if (q.sort !== 'name') out = out.order('min_price', { ascending: true });
  return out
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
    .order('model_id', { ascending: true });
}
