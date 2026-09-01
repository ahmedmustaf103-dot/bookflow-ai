type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function Stat({ label, value, hint }: Props) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--ink)] tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">{hint}</p>
      ) : null}
    </div>
  );
}
