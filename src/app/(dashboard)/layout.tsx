import { auth } from "@clerk/nextjs/server";

import { AppClerkProvider } from "@/components/providers/clerk-provider";
import {
  DashboardShell,
  type NavItem,
} from "@/components/dashboard/dashboard-shell";
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
  const atLeast = (min: MembershipRole) => ROLE_RANK[role] >= ROLE_RANK[min];

  const nav: NavItem[] = ctx.organization
    ? (
        [
          {
            href: "/dashboard",
            label: "Overview",
            group: "operate" as const,
            min: "VIEWER" as const,
          },
          {
            href: "/dashboard/appointments",
            label: "Calendar",
            group: "operate" as const,
            min: "STAFF" as const,
          },
          {
            href: "/dashboard/settings/calendar",
            label: "Google Calendar",
            group: "operate" as const,
            min: "STAFF" as const,
          },
          {
            href: "/dashboard/clients",
            label: pack.terminology.clients,
            group: "operate" as const,
            min: "STAFF" as const,
          },
          {
            href: "/dashboard/ai",
            label: "AI",
            group: "operate" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/analytics",
            label: "Analytics",
            group: "operate" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/locations",
            label: `${pack.terminology.location}s`,
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/staff",
            label: pack.terminology.resources,
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/services",
            label: pack.terminology.services,
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/availability",
            label: "Hours",
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/settings/team",
            label: "Team",
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/billing",
            label: "Billing",
            group: "setup" as const,
            min: "ADMIN" as const,
          },
          {
            href: "/dashboard/settings",
            label: "Settings",
            group: "setup" as const,
            min: "ADMIN" as const,
          },
        ] as const
      )
        .filter((item) => atLeast(item.min))
        .map(({ href, label, group }) => ({ href, label, group }))
    : [];

  const orgs = ctx.memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organization.name,
    slug: membership.organization.slug,
  }));

  return (
    <AppClerkProvider>
      <DashboardShell
        orgName={ctx.organization?.name}
        currentOrgId={ctx.organization?.id ?? null}
        orgs={orgs}
        nav={nav}
      >
        {children}
      </DashboardShell>
    </AppClerkProvider>
  );
}
