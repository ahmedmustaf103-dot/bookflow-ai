"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/result";

type Props = {
  action: (formData: FormData) => Promise<ActionResult<{ id: string } | void>>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  /** When true (default), reset form after create-style success. Set false for edit forms. */
  resetOnSuccess?: boolean;
  successMessage?: string;
};

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  resetOnSuccess = true,
  successMessage = "Saved",
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(false), 2000);
    return () => window.clearTimeout(t);
  }, [success]);

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
              toast(result.error, "error");
              return;
            }
            if (resetOnSuccess) {
              form.reset();
            }
            setSuccess(true);
            toast(successMessage, "success");
            router.refresh();
          } catch {
            const msg = "Something went wrong. Please try again.";
            setError(msg);
            toast(msg, "error");
          }
        });
      }}
    >
      {children}
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="bf-success-flash flex items-center gap-1.5 text-sm text-[var(--success)]"
          role="status"
        >
          <span className="bf-check" aria-hidden>
            ✓
          </span>
          {successMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
