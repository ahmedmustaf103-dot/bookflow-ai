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
};

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          e.currentTarget.reset();
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
