'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Something went wrong</h2>
          <p className="mb-6 text-sm text-gray-500">
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
          {error.digest && (
            <p className="mt-4 text-xs text-gray-400">Error ID: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
