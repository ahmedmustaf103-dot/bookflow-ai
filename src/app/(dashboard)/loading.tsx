export default function DashboardLoading() {
  return (
    <div
      className="animate-pulse space-y-4 p-1"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-9 w-48 rounded-md bg-[var(--color-border)]" />
      <div className="h-4 w-72 rounded bg-[var(--color-border)]" />
      <div className="mt-6 h-40 rounded-lg bg-[var(--color-border)]" />
      <div className="h-40 rounded-lg bg-[var(--color-border)]" />
    </div>
  );
}
