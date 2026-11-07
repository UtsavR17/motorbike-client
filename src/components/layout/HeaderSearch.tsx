import { Search } from 'lucide-react';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { MAX_SEARCH_LENGTH } from '@/lib/params';

/** Searches motorcycles and spare parts and opens the unified results page (/search?q=...). */
export function HeaderSearch({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  return (
    <CleanGetForm action="/search" role="search" aria-label="Search the shop" onNavigate={onNavigate} className="w-full">
      <label htmlFor={id} className="sr-only">
        Search motorcycles and spare parts
      </label>
      <div className="relative">
        <input
          id={id}
          name="q"
          type="search"
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="Search bikes and parts, e.g. Yamaha"
          autoComplete="off"
          className="h-10 w-full rounded-control border border-white/15 bg-white pl-3 pr-11 text-sm text-ink placeholder:text-ink-muted focus:border-accent"
        />
        <button
          type="submit"
          className="absolute right-1 top-1 inline-flex h-8 w-9 items-center justify-center rounded-md bg-accent text-ink transition-colors hover:bg-accent-hover"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </button>
      </div>
    </CleanGetForm>
  );
}
