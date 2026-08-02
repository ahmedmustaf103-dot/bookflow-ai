import type { ComponentProps } from "react";

const fieldClass =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";

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
  return <textarea className={`${fieldClass} ${className}`} {...props} />;
}
