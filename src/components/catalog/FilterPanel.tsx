'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * Sidebar on large screens; a collapsible panel behind a "Filters" button on small screens.
 */
export function FilterPanel({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="filter-panel"
        onClick={() => setOpen((v) => !v)}
        className="btn-outline w-full lg:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        {open ? 'Hide filters' : 'Show filters'}
        {activeCount > 0 && (
          <>
            <span aria-hidden="true" className="rounded-full bg-accent px-2 text-xs text-ink">
              {activeCount}
            </span>
            <span className="sr-only">({activeCount} active)</span>
          </>
        )}
      </button>
      <div id="filter-panel" className={`${open ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
