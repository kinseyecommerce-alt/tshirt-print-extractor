// ============================================================
// Skeleton loaders — shimmer placeholders shown while content loads.
// ============================================================

/** A single shimmer block. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800 ${className}`} />;
}

/** Card-shaped skeleton used while a job is processing (matches result panels). */
export function SkeletonResult({ label = 'Processing…' }) {
  return (
    <div className="card space-y-3">
      <div className="checkerboard flex h-64 items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-brand-500" />
          <span className="text-sm">{label}</span>
        </div>
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}
