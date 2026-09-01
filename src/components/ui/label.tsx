import type { ComponentProps } from "react";

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label
      className={`mb-1.5 block text-xs font-medium text-[var(--ink-secondary)] ${className}`}
      {...props}
    />
  );
}
