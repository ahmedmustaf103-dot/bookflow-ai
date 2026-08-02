import { auth } from "@clerk/nextjs/server";

import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getActiveOrganization } from "@/server/tenant/context";
import { getVerticalPack } from "@/server/verticals/packs";
import type { MembershipRole } from "@/generated/prisma/client";

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
  OWNER: 4,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  const ctx = await getActiveOrganization();
  const pack = getVerticalPack(
    ctx.organization?.verticalPack ?? "barber_salon",
  );
  const role = ctx.membership?.role ?? "VIEWER";
  const atLeast = (min: MembershipRole) =>
    ROLE_RANK[role] >= ROLE_RANK[min];

  const nav = ctx.organization
    ? [
        { href: "/dashboard", label: "Overview", min: "VIEWER" as const },
        {
          href: "/dashboard/appointments",
          label: "Appointments",
          min: "STAFF" as const,
        },
        {
          href: "/dashboard/clients",
          label: pack.terminology.clients,
          min: "STAFF" as const,
        },
        { href: "/dashboard/ai", label: "AI", min: "STAFF" as const },
        {
          href: "/dashboard/analytics",
          label: "Analytics",
          min: "STAFF" as const,
        },
        {
          href: "/dashboard/locations",
          label: `${pack.terminology.location}s`,
          min: "ADMIN" as const,
        },
        {
          href: "/dashboard/staff",
          label: pack.terminology.resources,
          min: "ADMIN" as const,
        },
        {
          href: "/dashboard/services",
          label: pack.terminology.services,
          min: "ADMIN" as const,
        },
        {
          href: "/dashboard/availability",
          label: "Hours",
          min: "ADMIN" as const,
        },
        { href: "/dashboard/billing", label: "Billing", min: "ADMIN" as const },
        {
          href: "/dashboard/settings",
          label: "Settings",
          min: "ADMIN" as const,
        },
      ]
        .filter((item) => atLeast(item.min))
        .map(({ href, label }) => ({ href, label }))
    : [];

  return (
    <AppClerkProvider>
      <DashboardShell orgName={ctx.organization?.name} nav={nav}>
        {children}
      </DashboardShell>
    </AppClerkProvider>
  );
}
