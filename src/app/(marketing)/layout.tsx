import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Syne } from "next/font/google";

import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { ButtonLink } from "@/components/ui/button";
import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";
import { onboardingCopy } from "@/lib/onboarding/copy";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-marketing-display",
});

function MarketingAuthActions() {
  if (clerkPublishableKeyIsPlaceholder()) {
    return (
      <>
        <ButtonLink
          href="/sign-in"
          variant="ghost"
          className="text-white/90 hover:bg-white/10 hover:text-white"
        >
          Sign in
        </ButtonLink>
        <ButtonLink
          href="/sign-up"
          variant="secondary"
          className="border-0 bg-white text-[var(--accent)] hover:bg-white/90"
        >
          Start free
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-white/90 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            Sign in
          </button>
        </SignInButton>
        <ButtonLink
          href="/sign-up"
          variant="secondary"
          className="border-0 bg-white text-[var(--accent)] hover:bg-white/90"
        >
          Start free
        </ButtonLink>
      </Show>
      <Show when="signed-in">
        <ButtonLink
          href="/dashboard"
          variant="secondary"
          className="border-0 bg-white text-[var(--accent)] hover:bg-white/90"
        >
          Dashboard
        </ButtonLink>
        <UserButton />
      </Show>
    </>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider>
      <div className={`${syne.variable} flex min-h-screen flex-col`}>
        <header className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
            <Link
              href="/"
              className="font-marketing text-base font-bold tracking-tight text-white"
            >
              BookFlow AI
            </Link>
            <nav className="flex items-center gap-3">
              <Link
                href="/demo"
                className="rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                {onboardingCopy.tryDemo.nav}
              </Link>
              <a
                href="#product"
                className="hidden rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:inline"
              >
                Product
              </a>
              <a
                href="#how"
                className="hidden rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:inline"
              >
                How it works
              </a>
              <MarketingAuthActions />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-marketing text-sm font-semibold text-[var(--ink)]">
              BookFlow AI
            </p>
            <p className="text-sm text-[var(--ink-secondary)]">
              Online booking, reminders, and AI
            </p>
            <div className="flex gap-4 text-sm text-[var(--ink-secondary)]">
              <Link href="/demo" className="hover:text-[var(--ink)]">
                {onboardingCopy.tryDemo.nav}
              </Link>
              <Link href="/sign-up" className="hover:text-[var(--ink)]">
                Start free
              </Link>
              <Link href="/book/bookflow-demo" className="hover:text-[var(--ink)]">
                Try a booking
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </AppClerkProvider>
  );
}
