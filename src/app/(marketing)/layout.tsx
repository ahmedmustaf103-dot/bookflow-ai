import Link from "next/link";
import { Syne } from "next/font/google";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { onboardingCopy } from "@/lib/onboarding/copy";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-marketing-display",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider>
      <div className={`${syne.variable} flex min-h-screen flex-col`}>
        <MarketingHeader />
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
              <Link
                href="/book/bookflow-demo"
                className="hover:text-[var(--ink)]"
              >
                Try a booking
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </AppClerkProvider>
  );
}
