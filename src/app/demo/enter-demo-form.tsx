"use client";

import { useState, useTransition } from "react";

import { enterDemoAction } from "@/server/actions/demo";
import { Button } from "@/components/ui/button";
import { onboardingCopy } from "@/lib/onboarding/copy";

export function EnterDemoForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = onboardingCopy.tryDemo;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await enterDemoAction();
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "Opening…" : copy.continue}
      </Button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
