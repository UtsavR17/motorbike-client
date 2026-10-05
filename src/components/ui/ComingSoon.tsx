import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Friendly placeholder for features that arrive in a later phase. */
export function ComingSoon({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <Icon aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="mt-3 text-ink-muted">{children}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/parts" className="btn-dark">
            Browse parts
          </Link>
          <Link href="/bikes" className="btn-outline">
            See motorcycles
          </Link>
        </div>
      </div>
    </div>
  );
}
