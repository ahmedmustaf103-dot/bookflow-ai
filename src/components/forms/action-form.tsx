"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/result";

type Props = {
  action: (formData: FormData) => Promise<ActionResult<{ id: string } | void>>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  /** When true (default), reset form after create-style success. Set false for edit forms. */
  resetOnSuccess?: boolean;
};

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  resetOnSuccess = true,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            if (resetOnSuccess) {
              form.reset();
            }
            setSuccess(true);
            router.refresh();
          } catch {
            setError("Something went wrong. Please try again.");
          }
        });
      }}
    >
      {children}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-800" role="status">
          Saved.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
