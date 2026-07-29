import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { getActiveOrganization } from "@/server/tenant/context";
import { getVerticalPack } from "@/server/verticals/packs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  const ctx = await getActiveOrganization();
  const pack = getVerticalPack(ctx.organization?.verticalPack ?? "barber_salon");

  const nav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/appointments", label: "Appointments" },
    { href: "/dashboard/clients", label: pack.terminology.clients },
    { href: "/dashboard/ai", label: "AI" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/locations", label: `${pack.terminology.location}s` },
    { href: "/dashboard/staff", label: pack.terminology.resources },
    { href: "/dashboard/services", label: pack.terminology.services },
    { href: "/dashboard/availability", label: "Hours" },
    { href: "/dashboard/billing", label: "Billing" },
    { href: "/dashboard/settings", label: "Settings" },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-paper)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link href="/dashboard" className="font-display shrink-0 text-lg">
              BookFlow AI
            </Link>
            {ctx.organization ? (
              <nav className="hidden gap-4 text-sm text-[var(--color-ink)]/70 md:flex">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:text-[var(--color-ink)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {ctx.organization ? (
              <span className="hidden max-w-[10rem] truncate text-sm text-[var(--color-ink)]/60 sm:inline">
                {ctx.organization.name}
              </span>
            ) : null}
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
