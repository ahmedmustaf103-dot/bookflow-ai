"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyField({
  value,
  label,
  onCopied,
}: {
  value: string;
  label: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <label className="sr-only" htmlFor="copy-field">
        {label}
      </label>
      <input
        id="copy-field"
        readOnly
        value={value}
        className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--muted)] px-3 text-sm text-[var(--ink-secondary)]"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast("Link copied", "success");
          onCopied?.();
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <span className="bf-check inline-flex items-center gap-1">
            ✓ Copied
          </span>
        ) : (
          "Copy"
        )}
      </Button>
    </div>
  );
}
