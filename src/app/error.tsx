"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="font-display text-2xl">Something went wrong</h2>
      <p className="text-sm text-[var(--color-ink)]/70">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
      >
        Try again
      </button>
    </div>
  );
}
