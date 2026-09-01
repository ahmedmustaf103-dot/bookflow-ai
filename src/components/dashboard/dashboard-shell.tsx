"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

import { CommandPalette } from "@/components/dashboard/command-palette";
import {
  EnsureDemoShop,
  OrgSwitcher,
  type DashboardOrgOption,
} from "@/components/dashboard/org-switcher";
import {
  DashboardTour,
  type DashboardTourKind,
} from "@/components/onboarding/dashboard-tour";
import { Kbd } from "@/components/ui/kbd";
import { ToastEventBridge, ToastProvider } from "@/components/ui/toast";

export type NavItem = {
  href: string;
  label: string;
  group: "operate" | "setup";
};

const NAV_TOUR_TARGET: Record<string, string> = {
  "/dashboard/settings": "owner-business",
  "/dashboard/services": "owner-services",
  "/dashboard/staff": "owner-staff",
  "/dashboard/availability": "owner-hours",
  "/dashboard/appointments": "nav-calendar",
  "/dashboard/clients": "nav-customers",
};

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
                  data-tour={NAV_TOUR_TARGET[item.href]}
                  onClick={onNavigate}
                  className={`relative flex min-h-11 items-center rounded-[var(--radius-control)] px-2.5 py-2 text-[15px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none md:min-h-0 md:py-1.5 md:text-[13px] ${
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
  currentOrgId,
  orgs = [],
  nav,
  tourKind = "none",
  children,
}: {
  orgName?: string | null;
  currentOrgId?: string | null;
  orgs?: DashboardOrgOption[];
  nav: NavItem[];
  tourKind?: DashboardTourKind;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function openNav() {
      setOpen(true);
    }
    function closeNav() {
      setOpen(false);
    }
    window.addEventListener("bookflow:open-mobile-nav", openNav);
    window.addEventListener("bookflow:close-mobile-nav", closeNav);
    return () => {
      window.removeEventListener("bookflow:open-mobile-nav", openNav);
      window.removeEventListener("bookflow:close-mobile-nav", closeNav);
    };
  }, []);

  const flatNav = nav.map(({ href, label }) => ({ href, label }));
  const demoOrgId =
    orgs.find((org) => org.slug === "bookflow-demo")?.id ?? null;

  return (
    <ToastProvider>
      <ToastEventBridge />
      <EnsureDemoShop
        demoOrgId={demoOrgId}
        currentOrgId={currentOrgId ?? null}
      />
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
          {orgs.length > 0 ? (
            <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId ?? null} />
          ) : orgName ? (
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
              <span className="text-xs text-[var(--ink-tertiary)]">
                Account
              </span>
            </div>
          </div>
        </aside>

        {/* Mobile */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 backdrop-blur md:hidden">
            <Link href="/dashboard" className="truncate text-sm font-semibold">
              BookFlow AI
            </Link>
            <div className="flex items-center gap-2">
              {nav.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                  aria-expanded={open}
                  aria-controls="mobile-nav"
                  data-tour="mobile-menu"
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
              {orgs.length > 1 ? (
                <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId ?? null} />
              ) : null}
              <NavLinks
                items={nav}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </div>
          ) : null}

          <main className="bf-page-enter mx-auto w-full max-w-[1200px] min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </main>
        </div>

        {nav.length > 0 ? <CommandPalette nav={flatNav} /> : null}
        <DashboardTour kind={tourKind} orgId={currentOrgId ?? null} />
      </div>
    </ToastProvider>
  );
}
