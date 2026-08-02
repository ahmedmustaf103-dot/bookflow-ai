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
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (resetOnSuccess) {
            e.currentTarget.reset();
          }
          setSuccess(true);
          router.refresh();
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
