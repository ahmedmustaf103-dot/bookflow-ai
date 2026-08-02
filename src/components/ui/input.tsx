import type { ComponentProps } from "react";

const fieldClass =
  "h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:outline-none disabled:opacity-50";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: ComponentProps<"select">) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`min-h-[88px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:outline-none disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
