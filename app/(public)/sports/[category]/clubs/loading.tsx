import { Skeleton } from '@/components/ui/skeleton';

export default function ClubListingLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />

      {/* Filter bar */}
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 flex-1" />
      </div>

      {/* Club rows */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <Skeleton className="size-14 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <div className="flex gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="hidden h-9 w-24 rounded-md sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
