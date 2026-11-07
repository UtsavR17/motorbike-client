import 'server-only';

// Search terms and the escaped ILIKE pattern live in ./query.ts (pure, unit-tested).

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
