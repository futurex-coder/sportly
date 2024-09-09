import { Skeleton } from '@/components/ui/skeleton';

export default function FieldDetailLoading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-44" />

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* Form content */}
      <div className="max-w-xl space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
