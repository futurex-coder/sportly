import { Skeleton } from '@/components/ui/skeleton';

export default function PlayersLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 flex-1" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-6">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="hidden h-4 w-12 sm:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <div className="ml-auto flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="size-3.5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
