type Props = {
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ title, description, className = "" }: Props) {
  return (
    <div
      className={`rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-12 text-center ${className}`}
      role="status"
    >
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--ink-tertiary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
