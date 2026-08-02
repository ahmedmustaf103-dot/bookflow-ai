type Props = {
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ title, description, className = "" }: Props) {
  return (
    <div
      className={`rounded-lg border border-dashed border-[var(--color-border)] px-4 py-10 text-center ${className}`}
      role="status"
    >
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-[var(--color-ink)]/65">{description}</p>
      ) : null}
    </div>
  );
}
