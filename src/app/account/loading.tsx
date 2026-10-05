export default function Loading() {
  return (
    <div role="status" aria-label="Loading your account" className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-line" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-line" />
      <div className="card h-48 animate-pulse" />
      <span className="sr-only">Loading your account</span>
    </div>
  );
}
