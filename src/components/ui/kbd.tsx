import type { ComponentProps } from "react";

export function Kbd({ className = "", ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-[var(--border)] bg-[var(--muted)] px-1 font-sans text-[10px] font-medium text-[var(--ink-tertiary)] ${className}`}
      {...props}
    />
  );
}
