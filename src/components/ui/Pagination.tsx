import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}

/** Page numbers to show: first, last, and a window around the current page. */
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

const itemClass =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-control border px-3 text-sm font-medium transition-colors';

export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  if (pageCount <= 1) return null;
  const prev = page > 1 ? hrefFor(page - 1) : null;
  const next = page < pageCount ? hrefFor(page + 1) : null;

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {prev ? (
        <Link href={prev} className={`${itemClass} border-line bg-card hover:border-ink`} rel="prev">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          <span>Previous</span>
        </Link>
      ) : (
        <span className={`${itemClass} border-line text-ink-muted`} aria-disabled="true">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          <span>Previous</span>
        </span>
      )}

      <ul className="flex flex-wrap items-center gap-2">
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">
              ...
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={`${itemClass} ${
                  p === page ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'
                }`}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>

      {next ? (
        <Link href={next} className={`${itemClass} border-line bg-card hover:border-ink`} rel="next">
          <span>Next</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${itemClass} border-line text-ink-muted`} aria-disabled="true">
          <span>Next</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

export function ResultCount({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <p className="text-sm text-ink-muted" role="status">
      Showing {from} to {to} of {total}
    </p>
  );
}
