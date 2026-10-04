import Link from 'next/link';
import { X } from 'lucide-react';

export interface FilterChip {
  key: string;
  label: string;
  removeHref: string;
}

/** Removable chips for every active filter, plus a "Clear filters" link. */
export function ActiveFilters({ chips, clearHref }: { chips: FilterChip[]; clearHref: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-3 pr-2 text-sm font-medium hover:border-ink"
        >
          {chip.label}
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="sr-only">(remove filter)</span>
        </Link>
      ))}
      <Link href={clearHref} className="link px-1 text-sm">
        Clear filters
      </Link>
    </div>
  );
}
