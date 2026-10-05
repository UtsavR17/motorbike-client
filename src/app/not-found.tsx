import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <SearchX aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">We could not find that page</h1>
        <p className="mt-3 text-ink-muted">
          The product may have been removed or the link is incorrect. Try the catalogue instead.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/parts" className="btn-dark">
            Browse parts
          </Link>
          <Link href="/bikes" className="btn-outline">
            See motorcycles
          </Link>
          <Link href="/" className="btn-outline">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
