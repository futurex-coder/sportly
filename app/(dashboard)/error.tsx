'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="text-destructive mb-4 size-12" />
      <h2 className="mb-2 text-2xl font-bold">Dashboard Error</h2>
      <p className="text-muted-foreground mb-6 max-w-md text-sm">
        Something went wrong loading this page. Please try again or return to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-muted-foreground mt-4 text-xs">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
