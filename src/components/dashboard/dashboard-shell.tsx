"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";

type NavItem = { href: string; label: string };

export function DashboardShell({
  orgName,
  nav,
  children,
}: {
  orgName?: string | null;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-paper)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link href="/dashboard" className="font-display shrink-0 text-lg">
              BookFlow AI
            </Link>
            {nav.length > 0 ? (
              <nav className="hidden gap-3 overflow-x-auto text-sm text-[var(--color-ink)]/70 lg:flex">
                {nav.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "font-medium text-[var(--color-ink)]"
                          : "hover:text-[var(--color-ink)]"
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {orgName ? (
              <span className="hidden max-w-[10rem] truncate text-sm text-[var(--color-ink)]/60 sm:inline">
                {orgName}
              </span>
            ) : null}
            {nav.length > 0 ? (
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm lg:hidden focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((v) => !v)}
              >
                Menu
              </button>
            ) : null}
            <UserButton />
          </div>
        </div>
        {open && nav.length > 0 ? (
          <nav
            id="mobile-nav"
            className="border-t border-[var(--color-border)] px-6 py-3 lg:hidden"
          >
            <ul className="flex flex-col gap-1 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-md px-2 py-2 hover:bg-[var(--color-muted)]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
