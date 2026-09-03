import Link from "next/link";

import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { onboardingCopy } from "@/lib/onboarding/copy";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider>
      <div className="flex min-h-screen flex-col bg-[var(--bg)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-[var(--ink)]"
            >
              BookFlow AI
            </Link>
            <Link
              href="/"
              className="text-sm text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            >
              {onboardingCopy.tryDemo.backHome}
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </AppClerkProvider>
  );
}
