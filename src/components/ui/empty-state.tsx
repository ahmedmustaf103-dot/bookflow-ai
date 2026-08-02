import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  className = "",
  action,
}: Props) {
  return (
    <div
      className={`rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-12 text-center ${className}`}
      role="status"
    >
      <div
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--ink-tertiary)]"
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="6"
            width="16"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 10h8M8 14h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--ink-tertiary)]">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4 flex justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
