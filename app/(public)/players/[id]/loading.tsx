import { Skeleton } from '@/components/ui/skeleton';

export default function PlayerProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Skeleton className="h-4 w-24" />

      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>

      {/* Rankings card */}
      <div className="rounded-xl border p-5">
        <Skeleton className="mb-4 h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-4 flex items-center gap-3">
            <Skeleton className="size-8" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="size-4" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div className="rounded-xl border p-5">
        <Skeleton className="mb-4 h-5 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-3 flex items-start gap-3 rounded-lg border p-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
