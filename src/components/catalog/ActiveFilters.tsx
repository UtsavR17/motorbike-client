import Link from 'next/link';
import { X } from 'lucide-react';

export interface FilterChip {
  key: string;
  label: string;
  removeHref: string;
}

/**
 * Removable chips for the search and every active filter. "Clear filters" keeps the search and
 * "Clear search" keeps the filters (Fix Phase 6); each link is shown only when it would change
 * something.
 */
export function ActiveFilters({
  chips,
  clearFiltersHref,
  clearSearchHref,
}: {
  chips: FilterChip[];
  clearFiltersHref?: string | null;
  clearSearchHref?: string | null;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          aria-label={`Remove filter: ${chip.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-3 pr-2 text-sm font-medium hover:border-ink"
        >
          {chip.label}
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      ))}
      {clearFiltersHref && (
        <Link href={clearFiltersHref} className="link px-1 text-sm">
          Clear filters
        </Link>
      )}
      {clearSearchHref && (
        <Link href={clearSearchHref} className="link px-1 text-sm">
          Clear search
        </Link>
      )}
    </div>
  );
}
