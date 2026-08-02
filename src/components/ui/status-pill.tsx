const tones: Record<string, string> = {
  PENDING: "bg-[var(--warning-soft)] text-[var(--warning)]",
  CONFIRMED: "bg-[var(--accent-soft)] text-[var(--accent)]",
  COMPLETED: "bg-[var(--success-soft)] text-[var(--success)]",
  NO_SHOW: "bg-[var(--muted)] text-[var(--ink-secondary)]",
  CANCELLED: "bg-[var(--danger-soft)] text-[var(--danger)]",
  default: "bg-[var(--muted)] text-[var(--ink-secondary)]",
};

export function StatusPill({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const tone = tones[status] ?? tones.default;
  const label = status.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
