"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="text-sm text-[var(--color-ink)]/70">
        This page hit an unexpected error. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        Try again
      </button>
    </div>
  );
}
