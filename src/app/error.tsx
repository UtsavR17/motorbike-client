'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Production builds only expose a digest; details stay in the server log.
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center" role="alert">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-bad-soft text-bad">
          <TriangleAlert aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-ink-muted">
          We could not load this page right now. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn-dark">
            Try again
          </button>
          <Link href="/" className="btn-outline">
            Go to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}
