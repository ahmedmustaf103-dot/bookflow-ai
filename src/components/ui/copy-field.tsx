"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

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
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
