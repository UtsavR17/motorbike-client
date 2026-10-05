import { Search } from 'lucide-react';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { MAX_SEARCH_LENGTH } from '@/lib/params';

/** Searches parts by name and opens the parts listing (/parts?q=...). */
export function HeaderSearch({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  return (
    <CleanGetForm action="/parts" role="search" aria-label="Search parts" onNavigate={onNavigate} className="w-full">
      <label htmlFor={id} className="sr-only">
        Search parts
      </label>
      <div className="relative">
        <input
          id={id}
          name="q"
          type="search"
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="Search parts, e.g. spark plug"
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
