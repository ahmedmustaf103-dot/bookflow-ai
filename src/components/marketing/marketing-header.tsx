"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

import { ButtonLink } from "@/components/ui/button";
import { clerkPublishableKeyIsPlaceholder } from "@/lib/clerk-placeholders";
import { onboardingCopy } from "@/lib/onboarding/copy";

function MarketingAuthActions({ stacked = false }: { stacked?: boolean }) {
  const wrap = stacked ? "flex w-full flex-col gap-2" : "contents";
  const ghostLink = stacked
    ? "flex min-h-11 items-center rounded-md px-3 text-sm text-white/90 hover:bg-white/10"
    : "rounded-md px-3 py-2 text-sm text-white/90 hover:bg-white/10";
  const startFreeClass = stacked
    ? "h-11 w-full border-0 bg-white text-[var(--accent)] hover:bg-white/90"
    : "border-0 bg-white text-[var(--accent)] hover:bg-white/90";

  if (clerkPublishableKeyIsPlaceholder()) {
    return (
      <div className={wrap}>
        <ButtonLink href="/sign-in" variant="ghost" className={ghostLink}>
          Sign in
        </ButtonLink>
        <ButtonLink
          href="/sign-up"
          variant="secondary"
          className={startFreeClass}
        >
          Start free
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className={`${ghostLink} focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none`}
          >
            Sign in
          </button>
        </SignInButton>
        <ButtonLink
          href="/sign-up"
          variant="secondary"
          className={startFreeClass}
        >
          Start free
        </ButtonLink>
      </Show>
      <Show when="signed-in">
        <ButtonLink
          href="/dashboard"
          variant="secondary"
          className={startFreeClass}
        >
          Dashboard
        </ButtonLink>
        <div
          className={stacked ? "flex min-h-11 items-center px-3" : "contents"}
        >
          <UserButton />
        </div>
      </Show>
    </div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
        <Link
          href="/"
          className="font-marketing shrink-0 text-sm font-bold tracking-tight whitespace-nowrap text-white sm:text-base"
        >
          BookFlow AI
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:hidden">
          <Link
            href="/demo"
            className="rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-white/10"
          >
            {onboardingCopy.tryDemo.nav}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-sm text-white/90 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>

        <nav className="hidden items-center gap-3 sm:flex">
          <Link
            href="/demo"
            className="rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            {onboardingCopy.tryDemo.nav}
          </Link>
          <a
            href="#product"
            className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            Product
          </a>
          <a
            href="#how"
            className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            How it works
          </a>
          <MarketingAuthActions />
        </nav>
      </div>

      {open ? (
        <nav
          id="marketing-mobile-nav"
          className="border-t border-white/15 bg-[#06352c]/90 px-5 py-3 backdrop-blur sm:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            <a
              href="#product"
              className="flex min-h-11 items-center rounded-md px-3 text-sm text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Product
            </a>
            <a
              href="#how"
              className="flex min-h-11 items-center rounded-md px-3 text-sm text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              How it works
            </a>
            <MarketingAuthActions stacked />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
