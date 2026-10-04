import Link from 'next/link';

interface SortLinksProps<T extends string> {
  current: T;
  options: Record<T, string>;
  hrefFor: (sort: T) => string;
}

/** Sort choices as plain links: shareable, keyboard friendly, no JavaScript needed. */
export function SortLinks<T extends string>({ current, options, hrefFor }: SortLinksProps<T>) {
  return (
    <nav aria-label="Sort results" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-muted">Sort by:</span>
      {(Object.keys(options) as T[]).map((key) => (
        <Link
          key={key}
          href={hrefFor(key)}
          aria-current={key === current ? 'true' : undefined}
          className={`rounded-full border px-3 py-1 font-medium transition-colors ${
            key === current ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'
          }`}
        >
          {options[key]}
        </Link>
      ))}
    </nav>
  );
}
