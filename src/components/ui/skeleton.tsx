export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--border)] ${className}`}
      aria-hidden
    />
  );
}
