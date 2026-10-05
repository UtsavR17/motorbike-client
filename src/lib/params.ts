// Typed, validated parsing of URL query parameters.
// Every parser ignores unknown or malformed input and falls back to a safe default,
// so a hand-edited URL can never crash a page or reach the database unchecked.

import { FINDER_MIN_YEAR } from '@/config/shop';

export type SearchParams = Record<string, string | string[] | undefined>;

export const MAX_SEARCH_LENGTH = 60;
const MAX_PAGE = 10_000;
const MAX_ID = 2_147_483_647; // Postgres integer
const MAX_PRICE = 1_000_000_000;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v.trim() : undefined;
}

/** Strict positive integer ("12" yes; "12abc", "-5", "1e3", "" no). */
export function parseId(value: string | string[] | undefined): number | undefined {
  const v = first(value);
  if (!v || !/^\d{1,10}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1 && n <= MAX_ID ? n : undefined;
}

export function parsePage(value: string | string[] | undefined): number {
  const v = first(value);
  if (!v || !/^\d{1,6}$/.test(v)) return 1;
  const n = Number(v);
  return Math.min(Math.max(n, 1), MAX_PAGE);
}

/** Non-negative price with up to 2 decimals. */
export function parsePrice(value: string | string[] | undefined): number | undefined {
  const v = first(value);
  if (!v || !/^\d{1,10}(\.\d{1,2})?$/.test(v)) return undefined;
  const n = Number(v);
  return n <= MAX_PRICE ? n : undefined;
}

export function maxFinderYear(): number {
  return new Date().getFullYear() + 1;
}

export function parseYear(value: string | string[] | undefined): number | undefined {
  const v = first(value);
  if (!v || !/^\d{4}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= FINDER_MIN_YEAR && n <= maxFinderYear() ? n : undefined;
}

/** Free text search: control characters removed, whitespace collapsed, length capped. */
export function parseSearch(value: string | string[] | undefined): string | undefined {
  const v = first(value);
  if (!v) return undefined;
  const cleaned = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const capped = cleaned.slice(0, MAX_SEARCH_LENGTH).trim();
  return capped === '' ? undefined : capped;
}

export function parseFlag(value: string | string[] | undefined): boolean {
  const v = first(value);
  return v === '1' || v === 'true' || v === 'on';
}

export function parseEnum<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = first(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Accepts the value only when it is one of the options currently in the catalogue. */
export function parseOption(
  value: string | string[] | undefined,
  options: readonly string[],
): string | undefined {
  const v = first(value);
  return v && options.includes(v) ? v : undefined;
}

/** Orders a min/max pair so min <= max. */
function orderRange(min?: number, max?: number): { min?: number; max?: number } {
  if (min !== undefined && max !== undefined && min > max) return { min: max, max: min };
  return { min, max };
}

/* ----------------------------- Parts listing ----------------------------- */

export const PART_SORTS = ['name', 'price_asc', 'price_desc'] as const;
export type PartSort = (typeof PART_SORTS)[number];

export const PART_SORT_LABELS: Record<PartSort, string> = {
  name: 'Name A to Z',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export interface PartsQuery {
  q?: string;
  category?: number;
  brand?: number;
  inStock: boolean;
  min?: number;
  max?: number;
  sort: PartSort;
  page: number;
  model?: number;
  year?: number;
}

export function parsePartsQuery(sp: SearchParams): PartsQuery {
  const model = parseId(sp.model);
  return {
    q: parseSearch(sp.q),
    category: parseId(sp.category),
    brand: parseId(sp.brand),
    inStock: parseFlag(sp.stock),
    ...orderRange(parsePrice(sp.min), parsePrice(sp.max)),
    sort: parseEnum(sp.sort, PART_SORTS, 'name'),
    page: parsePage(sp.page),
    model,
    // A year only makes sense together with a model.
    year: model ? parseYear(sp.year) : undefined,
  };
}

/** Canonical query string for a parts query; defaults are omitted. */
export function partsHref(query: PartsQuery, overrides: Partial<PartsQuery> = {}): string {
  const q = { ...query, ...overrides };
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.category) p.set('category', String(q.category));
  if (q.brand) p.set('brand', String(q.brand));
  if (q.inStock) p.set('stock', '1');
  if (q.min !== undefined) p.set('min', String(q.min));
  if (q.max !== undefined) p.set('max', String(q.max));
  if (q.model) p.set('model', String(q.model));
  if (q.model && q.year) p.set('year', String(q.year));
  if (q.sort !== 'name') p.set('sort', q.sort);
  if (q.page > 1) p.set('page', String(q.page));
  const s = p.toString();
  return s ? `/parts?${s}` : '/parts';
}

/* ---------------------------- Bikes listing ------------------------------ */

export const BIKE_SORTS = ['price_asc', 'price_desc', 'name'] as const;
export type BikeSort = (typeof BIKE_SORTS)[number];

export const BIKE_SORT_LABELS: Record<BikeSort, string> = {
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  name: 'Name A to Z',
};

export interface BikesQuery {
  q?: string;
  brand?: number;
  fuel?: string;
  transmission?: string;
  min?: number;
  max?: number;
  sort: BikeSort;
  page: number;
}

export interface BikeFacetOptions {
  fuelTypes: readonly string[];
  transmissions: readonly string[];
}

export function parseBikesQuery(sp: SearchParams, options: BikeFacetOptions): BikesQuery {
  return {
    q: parseSearch(sp.q),
    brand: parseId(sp.brand),
    fuel: parseOption(sp.fuel, options.fuelTypes),
    transmission: parseOption(sp.transmission, options.transmissions),
    ...orderRange(parsePrice(sp.min), parsePrice(sp.max)),
    sort: parseEnum(sp.sort, BIKE_SORTS, 'price_asc'),
    page: parsePage(sp.page),
  };
}

export function bikesHref(query: BikesQuery, overrides: Partial<BikesQuery> = {}): string {
  const q = { ...query, ...overrides };
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.brand) p.set('brand', String(q.brand));
  if (q.fuel) p.set('fuel', q.fuel);
  if (q.transmission) p.set('transmission', q.transmission);
  if (q.min !== undefined) p.set('min', String(q.min));
  if (q.max !== undefined) p.set('max', String(q.max));
  if (q.sort !== 'price_asc') p.set('sort', q.sort);
  if (q.page > 1) p.set('page', String(q.page));
  const s = p.toString();
  return s ? `/bikes?${s}` : '/bikes';
}
