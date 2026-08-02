import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-[0.16em] text-[var(--color-accent)] uppercase">
        Not found
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-tight">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 text-[var(--color-ink)]/70">
        Check the link or head back to BookFlow AI.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
      >
        Go home
      </Link>
    </div>
  );
}
