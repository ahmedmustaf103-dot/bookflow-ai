import Link from "next/link";

type Props = {
  label: string;
  href?: string;
  active?: boolean;
  muted?: boolean;
};

export function TagChip({ label, href, active, muted }: Props) {
  const className = `inline-flex max-w-full items-center truncate rounded-[var(--radius-control)] px-2 py-0.5 text-[11px] font-medium transition-colors ${
    active
      ? "bg-[var(--accent)] text-white"
      : muted
        ? "bg-[var(--muted)] text-[var(--ink-tertiary)]"
        : "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/15"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return <span className={className}>{label}</span>;
}
