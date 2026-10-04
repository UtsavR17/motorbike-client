import 'server-only';

import { MAX_SEARCH_LENGTH } from '@/lib/params';

/**
 * Builds a safe ILIKE "contains" pattern from user text.
 * LIKE wildcards (% and _) and the escape character are escaped so they match literally.
 * PostgREST turns every "*" into "%", so "*" is mapped to "_" (any single character):
 * it still matches a literal "*" and can never widen into a match-everything wildcard run.
 * The value is passed as a single filter value, never inside an .or() string.
 */
export function containsPattern(term: string): string {
  const escaped = term
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '_');
  return `%${escaped}%`;
}

export interface QueryError {
  code?: string;
  message: string;
}

/** PostgREST error for a .range() that starts past the last row. */
export function isRangeError(error: QueryError | null): boolean {
  return error?.code === 'PGRST103';
}

/** Logs only the error code and message (never row data) and throws for error.tsx. */
export function fail(context: string, error: QueryError): never {
  console.error(`[catalog] ${context} failed: ${error.code ?? 'unknown'} ${error.message}`);
  throw new Error(`Could not load ${context}.`);
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
