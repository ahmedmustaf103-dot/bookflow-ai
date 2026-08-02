"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

import { CommandPalette } from "@/components/dashboard/command-palette";
import { Kbd } from "@/components/ui/kbd";

export type NavItem = { href: string; label: string; group: "operate" | "setup" };

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const operate = items.filter((i) => i.group === "operate");
  const setup = items.filter((i) => i.group === "setup");

  function Section({ title, list }: { title: string; list: NavItem[] }) {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-wider text-[var(--ink-tertiary)] uppercase">
          {title}
        </p>
        <ul className="flex flex-col gap-0.5">
          {list.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`relative flex items-center rounded-[var(--radius-control)] px-2.5 py-1.5 text-[13px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
                    active
                      ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[var(--accent)] transition-all"
                      aria-hidden
                    />
                  ) : null}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
      <Section title="Operate" list={operate} />
      <Section title="Setup" list={setup} />
    </nav>
  );
}

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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const flatNav = nav.map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
          <Link
            href="/dashboard"
            className="truncate text-sm font-semibold tracking-tight text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            BookFlow AI
          </Link>
        </div>
        {orgName ? (
          <p className="truncate border-b border-[var(--border)] px-4 py-2.5 text-xs text-[var(--ink-tertiary)]">
            {orgName}
          </p>
        ) : null}
        <NavLinks items={nav} pathname={pathname} />
        <div className="mt-auto border-t border-[var(--border)] p-3">
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between rounded-[var(--radius-control)] border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--ink-tertiary)] hover:bg-[var(--muted)]"
            onClick={() => {
              window.dispatchEvent(new Event("bookflow:command-palette"));
            }}
          >
            <span>Jump to…</span>
            <span className="flex items-center gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="flex items-center gap-2 px-0.5">
            <UserButton />
            <span className="text-xs text-[var(--ink-tertiary)]">Account</span>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur md:hidden">
          <Link href="/dashboard" className="text-sm font-semibold">
            BookFlow AI
          </Link>
          <div className="flex items-center gap-2">
            {nav.length > 0 ? (
              <button
                type="button"
                className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((v) => !v)}
              >
                Menu
              </button>
            ) : null}
            <UserButton />
          </div>
        </header>

        {open && nav.length > 0 ? (
          <div
            id="mobile-nav"
            className="border-b border-[var(--border)] bg-[var(--surface)] md:hidden"
          >
            <NavLinks
              items={nav}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        ) : null}

        <main className="bf-page-enter mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {nav.length > 0 ? <CommandPalette nav={flatNav} /> : null}
    </div>
  );
}
