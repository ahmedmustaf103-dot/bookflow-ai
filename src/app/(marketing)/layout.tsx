import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { ButtonLink } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider>
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-display text-xl tracking-tight">
            BookFlow AI
          </Link>
          <nav className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  Sign in
                </button>
              </SignInButton>
              <ButtonLink href="/sign-up" variant="primary">
                Start free
              </ButtonLink>
            </Show>
            <Show when="signed-in">
              <ButtonLink href="/dashboard" variant="secondary">
                Dashboard
              </ButtonLink>
              <UserButton />
            </Show>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-[var(--color-ink)]/60">
          © {new Date().getFullYear()} BookFlow AI
        </footer>
      </div>
    </AppClerkProvider>
  );
}
