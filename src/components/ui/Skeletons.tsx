/** Loading placeholders. Pulse only; no other motion. */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-line/60" />
      <div className="space-y-3 p-4">
        <Bar className="h-3 w-1/3" />
        <Bar className="h-4 w-3/4" />
        <Bar className="h-5 w-1/2" />
      </div>
    </div>
  );
}

export function ListingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="border-b border-line bg-card">
        <div className="container-page space-y-3 py-6 sm:py-8">
          <Bar className="h-3 w-32" />
          <Bar className="h-8 w-64" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr] lg:gap-8 lg:py-8">
        <div className="card hidden h-96 animate-pulse lg:block" />
        <div className="space-y-4">
          <Bar className="h-4 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="container-page py-6 lg:py-8">
      <Bar className="h-3 w-48" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="card aspect-square animate-pulse bg-line/60" />
        <div className="space-y-4">
          <Bar className="h-3 w-24" />
          <Bar className="h-8 w-3/4" />
          <Bar className="h-9 w-40" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Bar className="h-16" />
            <Bar className="h-16" />
          </div>
          <Bar className="h-24" />
          <Bar className="h-11 w-40" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
